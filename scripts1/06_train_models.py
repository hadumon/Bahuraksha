"""
scripts/06_train_models.py

Train flood and landslide classifiers from preprocessed tables using
time-based splits (train/val/test by year) to reduce leakage.

Outputs:
  models/flood_model.pkl
  models/landslide_model.pkl
  models/flood_model_metrics.json
  models/landslide_model_metrics.json

Run:
  python scripts/06_train_models.py
"""

import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    roc_auc_score,
)

warnings.filterwarnings("ignore")

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import BBOX, DATA_TRAINING, MODELS_DIR


# Time-based split (inclusive boundaries)
TRAIN_END_YEAR = 2022
VAL_START_YEAR = 2023
VAL_END_YEAR = 2024
TEST_START_YEAR = 2025


def _safe_roc_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return float("nan")
    return float(roc_auc_score(y_true, y_prob))


def _safe_pr_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return float("nan")
    return float(average_precision_score(y_true, y_prob))


def _choose_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Choose threshold on validation by exact F1 sweep across unique model probabilities."""
    if len(y_prob) == 0:
        return 0.5

    candidates = np.unique(np.r_[0.0, y_prob, np.linspace(0.01, 0.99, 99), 1.0])
    best_t = 0.5
    best_f1 = -1.0
    best_acc = -1.0

    for t in candidates:
        y_pred = (y_prob >= t).astype(int)
        tp = int(((y_pred == 1) & (y_true == 1)).sum())
        fp = int(((y_pred == 1) & (y_true == 0)).sum())
        fn = int(((y_pred == 0) & (y_true == 1)).sum())
        tn = int(((y_pred == 0) & (y_true == 0)).sum())

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        acc = (tp + tn) / max(tp + tn + fp + fn, 1)

        # Tie-break by accuracy to prefer more stable decision boundary.
        if (f1 > best_f1) or (np.isclose(f1, best_f1) and acc > best_acc):
            best_f1 = float(f1)
            best_acc = float(acc)
            best_t = float(t)

    return best_t


def _evaluate_split(name: str, y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    result = {
        "split": name,
        "roc_auc": _safe_roc_auc(y_true, y_prob),
        "pr_auc": _safe_pr_auc(y_true, y_prob),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
    }
    return result


def _print_split_summary(task: str, split_name: str, df: pd.DataFrame) -> None:
    pos = int((df["label"] == 1).sum())
    neg = int((df["label"] == 0).sum())
    years = sorted(df["year"].dropna().unique().tolist())
    print(f"[{task}] {split_name}: rows={len(df)}, pos={pos}, neg={neg}, years={years}")


def _quality_warnings(task: str, df: pd.DataFrame) -> None:
    pos_ratio = float((df["label"] == 1).mean())
    if pos_ratio < 0.1 or pos_ratio > 0.9:
        print(f"[{task}] WARNING: strong class imbalance (positive ratio={pos_ratio:.3f}).")

    if "lat" in df.columns and "lon" in df.columns:
        outside = (
            (df["lat"] < BBOX["min_lat"]) |
            (df["lat"] > BBOX["max_lat"]) |
            (df["lon"] < BBOX["min_lon"]) |
            (df["lon"] > BBOX["max_lon"])
        )
        outside_n = int(outside.sum())
        if outside_n > 0:
            print(f"[{task}] WARNING: {outside_n} rows are outside configured BBOX.")

    dup = int(df.duplicated(subset=["date", "lat", "lon", "label"]).sum())
    if dup > 0:
        print(f"[{task}] WARNING: {dup} duplicate rows on (date, lat, lon, label).")


def _prepare_xy(df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
    drop_cols = [c for c in ["label", "date", "year", "landuse_class"] if c in df.columns]
    x = df.drop(columns=drop_cols).copy()
    y = df["label"].astype(int).to_numpy()

    # Keep only numeric features for both models.
    # landuse_class is dropped; landuse_code + ndvi_proxy remain numeric.
    x = x.apply(pd.to_numeric, errors="coerce")
    x = x.fillna(x.median(numeric_only=True)).fillna(0)
    return x, y


def _feature_importance_from_xgb(model, columns: list[str], top_k: int = 10) -> list[tuple[str, float]]:
    importances = model.feature_importances_
    pairs = sorted(zip(columns, importances), key=lambda t: t[1], reverse=True)
    return [(k, float(v)) for k, v in pairs[:top_k]]


def _coef_importance_from_lr(model, columns: list[str], top_k: int = 10) -> list[tuple[str, float]]:
    coef = model.coef_[0]
    pairs = sorted(zip(columns, np.abs(coef)), key=lambda t: t[1], reverse=True)
    return [(k, float(v)) for k, v in pairs[:top_k]]


def train_task(task_name: str, csv_name: str, model_out_name: str) -> dict:
    print("\n" + "=" * 68)
    print(f"[{task_name}] loading {csv_name}")

    csv_path = DATA_TRAINING / csv_name
    if not csv_path.exists():
        raise FileNotFoundError(f"Missing training file: {csv_path}")

    df = pd.read_csv(csv_path)
    required = {"date", "label"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{csv_name} missing required columns: {sorted(missing)}")

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "label"]).copy()
    df["year"] = df["date"].dt.year
    df["label"] = pd.to_numeric(df["label"], errors="coerce").fillna(0).astype(int)

    _quality_warnings(task_name, df)

    train_df = df[df["year"] <= TRAIN_END_YEAR].copy()
    val_df = df[(df["year"] >= VAL_START_YEAR) & (df["year"] <= VAL_END_YEAR)].copy()
    test_df = df[df["year"] >= TEST_START_YEAR].copy()

    _print_split_summary(task_name, "train", train_df)
    _print_split_summary(task_name, "val", val_df)
    _print_split_summary(task_name, "test", test_df)

    for split_name, split_df in [("train", train_df), ("val", val_df), ("test", test_df)]:
        if len(split_df) == 0:
            raise ValueError(f"[{task_name}] empty {split_name} split. Adjust year boundaries.")

    x_train, y_train = _prepare_xy(train_df)
    x_val, y_val = _prepare_xy(val_df)
    x_test, y_test = _prepare_xy(test_df)

    # Align columns across splits
    all_cols = sorted(set(x_train.columns) | set(x_val.columns) | set(x_test.columns))
    x_train = x_train.reindex(columns=all_cols, fill_value=0)
    x_val = x_val.reindex(columns=all_cols, fill_value=0)
    x_test = x_test.reindex(columns=all_cols, fill_value=0)

    # Baseline model: Logistic Regression
    lr = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)
    lr.fit(x_train, y_train)
    lr_val_prob = lr.predict_proba(x_val)[:, 1]
    lr_thr = _choose_threshold(y_val, lr_val_prob)

    lr_metrics_val = _evaluate_split("val", y_val, lr_val_prob, lr_thr)
    lr_metrics_test = _evaluate_split("test", y_test, lr.predict_proba(x_test)[:, 1], lr_thr)

    # Main model: XGBoost
    from xgboost import XGBClassifier

    pos = int((y_train == 1).sum())
    neg = int((y_train == 0).sum())
    scale_pos_weight = (neg / max(pos, 1))

    xgb_task_params = {
        "flood": {
            "n_estimators": 500,
            "max_depth": 3,
            "learning_rate": 0.05,
            "reg_lambda": 0.5,
        },
        "landslide": {
            "n_estimators": 700,
            "max_depth": 3,
            "learning_rate": 0.08,
            "reg_lambda": 1.0,
        },
    }.get(task_name, {
        "n_estimators": 500,
        "max_depth": 4,
        "learning_rate": 0.03,
        "reg_lambda": 1.0,
    })

    xgb = XGBClassifier(
        n_estimators=xgb_task_params["n_estimators"],
        max_depth=xgb_task_params["max_depth"],
        learning_rate=xgb_task_params["learning_rate"],
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=xgb_task_params["reg_lambda"],
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=4,
        scale_pos_weight=scale_pos_weight,
    )
    xgb.fit(x_train, y_train)

    xgb_val_prob = xgb.predict_proba(x_val)[:, 1]
    xgb_thr = _choose_threshold(y_val, xgb_val_prob)

    xgb_metrics_val = _evaluate_split("val", y_val, xgb_val_prob, xgb_thr)
    xgb_metrics_test = _evaluate_split("test", y_test, xgb.predict_proba(x_test)[:, 1], xgb_thr)

    print(f"[{task_name}] Logistic  val ROC-AUC={lr_metrics_val['roc_auc']:.3f}  PR-AUC={lr_metrics_val['pr_auc']:.3f}")
    print(f"[{task_name}] XGBoost   val ROC-AUC={xgb_metrics_val['roc_auc']:.3f}  PR-AUC={xgb_metrics_val['pr_auc']:.3f}")

    # Model selection: higher validation PR-AUC (better for class imbalance)
    lr_score = lr_metrics_val["pr_auc"] if not np.isnan(lr_metrics_val["pr_auc"]) else -1
    xgb_score = xgb_metrics_val["pr_auc"] if not np.isnan(xgb_metrics_val["pr_auc"]) else -1

    if xgb_score >= lr_score:
        selected_name = "xgboost"
        selected_model = xgb
        selected_threshold = xgb_thr
        selected_val = xgb_metrics_val
        selected_test = xgb_metrics_test
        feat_importance = _feature_importance_from_xgb(xgb, all_cols)
    else:
        selected_name = "logistic_regression"
        selected_model = lr
        selected_threshold = lr_thr
        selected_val = lr_metrics_val
        selected_test = lr_metrics_test
        feat_importance = _coef_importance_from_lr(lr, all_cols)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / model_out_name
    joblib.dump(
        {
            "model": selected_model,
            "model_name": selected_name,
            "threshold": selected_threshold,
            "feature_columns": all_cols,
            "split_config": {
                "train_end_year": TRAIN_END_YEAR,
                "val_start_year": VAL_START_YEAR,
                "val_end_year": VAL_END_YEAR,
                "test_start_year": TEST_START_YEAR,
            },
        },
        model_path,
    )

    metrics = {
        "task": task_name,
        "data_file": csv_name,
        "selected_model": selected_name,
        "selected_threshold": float(selected_threshold),
        "train_rows": int(len(train_df)),
        "val_rows": int(len(val_df)),
        "test_rows": int(len(test_df)),
        "train_pos": int((y_train == 1).sum()),
        "train_neg": int((y_train == 0).sum()),
        "val": selected_val,
        "test": selected_test,
        "baseline_logistic": {
            "val": lr_metrics_val,
            "test": lr_metrics_test,
        },
        "baseline_xgboost": {
            "val": xgb_metrics_val,
            "test": xgb_metrics_test,
        },
        "top_feature_importance": feat_importance,
    }

    metrics_path = MODELS_DIR / f"{model_out_name.replace('.pkl', '')}_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"[{task_name}] selected model: {selected_name}")
    print(f"[{task_name}] threshold: {selected_threshold:.4f}")
    print(f"[{task_name}] confusion matrix (test): {selected_test['confusion_matrix']}")
    print(f"[{task_name}] top features: {feat_importance[:8]}")
    print(f"[{task_name}] saved model:   {model_path}")
    print(f"[{task_name}] saved metrics: {metrics_path}")
    return metrics


def _acc_from_cm(cm: dict) -> float:
    total = cm["tn"] + cm["fp"] + cm["fn"] + cm["tp"]
    return (cm["tn"] + cm["tp"]) / total if total else 0.0


def write_training_markdown_report(flood_metrics: dict, landslide_metrics: dict) -> Path:
    report_path = MODELS_DIR / "TRAINING_METHOD_REPORT.md"

    f_val_cm = flood_metrics["val"]["confusion_matrix"]
    f_test_cm = flood_metrics["test"]["confusion_matrix"]
    l_val_cm = landslide_metrics["val"]["confusion_matrix"]
    l_test_cm = landslide_metrics["test"]["confusion_matrix"]

    content = f"""# Model Training Method Report

Generated by: `scripts/06_train_models.py`

## 1. How event prediction is made

For each sample, the selected classifier outputs a probability:

- `p = P(y=1 | x)`

Decision rule:

- predict event (`1`) if `p >= t`
- predict non-event (`0`) if `p < t`

Where `t` is the task-specific threshold chosen on the validation split.

## 2. Threshold formula used in this project

Threshold selection objective:

`t* = argmax_t F1(t)` on validation data.

Definitions at threshold `t`:

- `Precision(t) = TP / (TP + FP)`
- `Recall(t) = TP / (TP + FN)`
- `F1(t) = 2 * Precision(t) * Recall(t) / (Precision(t) + Recall(t))`

Implementation details:

- Candidate thresholds are produced by `sklearn.metrics.precision_recall_curve`.
- The script computes `F1` for each candidate threshold.
- The threshold with the maximum validation `F1` is selected.

Important note:

- This is a standard model-selection heuristic, not a universal physical constant.
- Thresholds should be re-tuned when data distribution, class balance, or policy priorities change.

## 3. Current selected thresholds (latest run)

- Flood threshold: `{flood_metrics['selected_threshold']:.6f}`
- Landslide threshold: `{landslide_metrics['selected_threshold']:.6f}`

## 4. Latest model metrics

### Flood (selected: {flood_metrics['selected_model']})

- Validation: ROC-AUC `{flood_metrics['val']['roc_auc']:.4f}`, PR-AUC `{flood_metrics['val']['pr_auc']:.4f}`, F1 `{flood_metrics['val']['f1']:.4f}`, Accuracy `{_acc_from_cm(f_val_cm):.4f}`
- Test: ROC-AUC `{flood_metrics['test']['roc_auc']:.4f}`, PR-AUC `{flood_metrics['test']['pr_auc']:.4f}`, F1 `{flood_metrics['test']['f1']:.4f}`, Accuracy `{_acc_from_cm(f_test_cm):.4f}`

Confusion matrix (test):

- TN `{f_test_cm['tn']}`, FP `{f_test_cm['fp']}`, FN `{f_test_cm['fn']}`, TP `{f_test_cm['tp']}`

### Landslide (selected: {landslide_metrics['selected_model']})

- Validation: ROC-AUC `{landslide_metrics['val']['roc_auc']:.4f}`, PR-AUC `{landslide_metrics['val']['pr_auc']:.4f}`, F1 `{landslide_metrics['val']['f1']:.4f}`, Accuracy `{_acc_from_cm(l_val_cm):.4f}`
- Test: ROC-AUC `{landslide_metrics['test']['roc_auc']:.4f}`, PR-AUC `{landslide_metrics['test']['pr_auc']:.4f}`, F1 `{landslide_metrics['test']['f1']:.4f}`, Accuracy `{_acc_from_cm(l_test_cm):.4f}`

Confusion matrix (test):

- TN `{l_test_cm['tn']}`, FP `{l_test_cm['fp']}`, FN `{l_test_cm['fn']}`, TP `{l_test_cm['tp']}`

## 5. Method references for report writing

Primary references:

1. scikit-learn `precision_recall_curve` docs:
   https://sklearn.org/stable/modules/generated/sklearn.metrics.precision_recall_curve.html

2. scikit-learn `f1_score` docs (harmonic mean of precision and recall):
   https://sklearn.org/stable/modules/generated/sklearn.metrics.f1_score.html

3. Van Rijsbergen, C.J. (1979), *Information Retrieval* (foundation of F-measure in IR):
   https://openlibrary.org/books/OL4739711M/Information_retrieval

## 6. Practical interpretation for this project

- Flood and landslide prediction are probability-threshold decisions.
- The reported threshold is the operational trigger used by the model artifact.
- If policy shifts toward higher recall (fewer misses) or higher precision (fewer false alarms), threshold should be re-optimized accordingly.
"""

    report_path.write_text(content, encoding="utf-8")
    return report_path


def main() -> None:
    print("=" * 68)
    print("  BAHURAKSHA — model training")
    print("=" * 68)
    print("Split strategy: time-based")
    print(f"  train: <= {TRAIN_END_YEAR}")
    print(f"  val:   {VAL_START_YEAR}-{VAL_END_YEAR}")
    print(f"  test:  >= {TEST_START_YEAR}")

    flood_metrics = train_task("flood", "flood_training.csv", "flood_model.pkl")
    landslide_metrics = train_task("landslide", "landslide_training.csv", "landslide_model.pkl")

    report_path = write_training_markdown_report(flood_metrics, landslide_metrics)

    print("\n" + "=" * 68)
    print("Training complete.")
    print(f"Models directory: {MODELS_DIR}")
    print(f"Method report: {report_path}")
    print("=" * 68)


if __name__ == "__main__":
    main()
