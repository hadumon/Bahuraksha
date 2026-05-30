"""
Reproducible landslide model training from raw CSV data.

Usage:
    python train_landslide_model.py                          # train with defaults
    python train_landslide_model.py --n-estimators 200 --max-depth 6
    python train_landslide_model.py --dry-run                # print metrics only, no save

Output:
    bahuraksha-api/models/landslide_model.pkl       # joblib bundle
    bahuraksha-api/models/landslide_model_metrics.json  # evaluation report
"""

import argparse
import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate
import xgboost as xgb

import config
from csv_models import load_daily_rainfall, zone_static_features

log = logging.getLogger("train_landslide_model")

FEATURE_COLUMNS = [
    "rf_1day", "rf_3day", "rf_7day", "rf_30day",
    "elevation_m", "slope_deg", "aspect_deg", "curvature",
    "landuse_code", "ndvi_proxy", "dist_drainage_m",
    "month", "day_of_year", "lat", "lon",
]

SPLIT_CONFIG = {
    "train_end_year": 2022,
    "val_start_year": 2023,
    "val_end_year": 2024,
    "test_start_year": 2025,
}

# ---------------------------------------------------------------------------
# Data Loading & Feature Engineering
# ---------------------------------------------------------------------------


def build_training_data() -> pd.DataFrame:
    """Build per-zone daily training data with rainfall + static features."""
    rain = load_daily_rainfall()
    zones = zone_static_features()

    rows = []
    for zone_id, sf in zones.items():
        zone_df = rain.copy()
        zone_df["zone_id"] = zone_id
        zone_df["lat"] = float(sf.get("lat", 27.72))
        zone_df["lon"] = float(sf.get("lon", 85.32))
        zone_df["elevation_m"] = sf.get("elevation_m", 1200.0)
        zone_df["slope_deg"] = sf.get("slope_deg", 8.0)
        zone_df["aspect_deg"] = sf.get("aspect_deg", 120.0)
        zone_df["curvature"] = sf.get("curvature", 0.0)
        zone_df["landuse_code"] = int(round(sf.get("landuse_code", 50)))
        zone_df["ndvi_proxy"] = sf.get("ndvi_proxy", 0.10)
        zone_df["dist_drainage_m"] = sf.get("dist_drainage_m", 1000.0)
        zone_df["month"] = zone_df["date"].dt.month
        zone_df["day_of_year"] = zone_df["date"].dt.dayofyear
        rows.append(zone_df)

    df = pd.concat(rows, ignore_index=True).sort_values(["date", "zone_id"]).reset_index(drop=True)

    for c in FEATURE_COLUMNS:
        if c not in df.columns:
            df[c] = 0.0

    return df[["date", "zone_id"] + FEATURE_COLUMNS].dropna().reset_index(drop=True)


# ---------------------------------------------------------------------------
# Synthetic Label Generation
# ---------------------------------------------------------------------------


def generate_flood_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate synthetic binary landslide labels using a physically-informed rule.

    A day is labeled as a landslide event when:
      - 7-day rainfall > 85th percentile AND 30-day rainfall > 70th percentile
        (prolonged wet period saturating soil), OR
      - 3-day rainfall > 90th percentile AND slope > median slope
        (intense short rain on steep terrain)

    High NDVI (>0.5, dense vegetation) reduces probability by 40%.
    Built-up areas (landuse_code == 50) increase probability by 20%.
    A 3% random flip adds noise for robustness.
    """
    rng = np.random.default_rng(42)

    rf7_high = df["rf_7day"] > df["rf_7day"].quantile(0.85)
    rf30_high = df["rf_30day"] > df["rf_30day"].quantile(0.70)
    rf3_extreme = df["rf_3day"] > df["rf_3day"].quantile(0.90)
    steep = df["slope_deg"] > df["slope_deg"].median()

    landslide = (rf7_high & rf30_high) | (rf3_extreme & steep)

    veg_shield = df["ndvi_proxy"] > 0.5
    built_up = df["landuse_code"] == 50

    noise = rng.uniform(size=len(df))
    adjusted = landslide.astype(float)
    adjusted[veg_shield] *= 0.6
    adjusted[built_up] *= 1.2
    landslide = adjusted > (0.5 * (1 + noise * 0.06 - 0.03))

    n_flip = int(len(df) * 0.03)
    flip_idx = rng.choice(len(df), n_flip, replace=False)
    landslide.iloc[flip_idx] = ~landslide.iloc[flip_idx]

    df["flood"] = landslide.astype(int)
    return df


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def _temporal_split(df: pd.DataFrame):
    """Split by year: train <= 2022, val 2023-2024, test >= 2025."""
    train = df[df["date"].dt.year <= SPLIT_CONFIG["train_end_year"]]
    val = df[
        (df["date"].dt.year >= SPLIT_CONFIG["val_start_year"])
        & (df["date"].dt.year <= SPLIT_CONFIG["val_end_year"])
    ]
    test = df[df["date"].dt.year >= SPLIT_CONFIG["test_start_year"]]
    return train, val, test


def _find_best_threshold(y_true, y_prob) -> float:
    """Find threshold maximizing F1 on validation."""
    thresholds = np.linspace(0.05, 0.95, 91)
    best_f1, best_t = 0.0, 0.43
    for t in thresholds:
        preds = (y_prob >= t).astype(int)
        f1 = f1_score(y_true, preds, zero_division=0)
        if f1 > best_f1:
            best_f1, best_t = f1, t
    return best_t


def train_flood_model(
    df: pd.DataFrame,
    n_estimators: int = 150,
    max_depth: int = 5,
    learning_rate: float = 0.05,
) -> dict:
    """Train an XGBoost landslide model with temporal split and threshold tuning."""
    train, val, test = _temporal_split(df)

    X_train = train[FEATURE_COLUMNS].values
    y_train = train["flood"].values
    X_val = val[FEATURE_COLUMNS].values
    y_val = val["flood"].values
    X_test = test[FEATURE_COLUMNS].values
    y_test = test["flood"].values

    pos_ratio = y_train.mean()
    scale_pos_weight = (1 - pos_ratio) / max(pos_ratio, 0.01)

    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=learning_rate,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric="auc",
        verbosity=0,
    )

    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    val_prob = model.predict_proba(X_val)[:, 1]
    threshold = _find_best_threshold(y_val, val_prob)

    test_prob = model.predict_proba(X_test)[:, 1]
    test_pred = (test_prob >= threshold).astype(int)

    val_roc = roc_auc_score(y_val, val_prob)
    val_pr = average_precision_score(y_val, val_prob)
    val_f1 = f1_score(y_val, (val_prob >= threshold).astype(int), zero_division=0)
    test_roc = roc_auc_score(y_test, test_prob)
    test_pr = average_precision_score(y_test, test_prob)
    test_f1 = f1_score(y_test, test_pred, zero_division=0)
    test_prec = precision_score(y_test, test_pred, zero_division=0)
    test_recall = recall_score(y_test, test_pred, zero_division=0)
    tn, fp, fn, tp = confusion_matrix(y_test, test_pred, labels=[0, 1]).ravel()

    cv = cross_validate(
        model, X_train, y_train, cv=StratifiedKFold(3, shuffle=True, random_state=42),
        scoring=["roc_auc", "average_precision"], n_jobs=1,
    )
    cv_roc = float(np.mean(cv["test_roc_auc"]))
    cv_pr = float(np.mean(cv["test_average_precision"]))

    importance = model.feature_importances_
    feat_imp = sorted(
        zip(FEATURE_COLUMNS, importance), key=lambda x: x[1], reverse=True
    )

    metrics = {
        "train_rows": len(train), "val_rows": len(val), "test_rows": len(test),
        "train_pos": int(y_train.sum()), "train_neg": int((1 - y_train).sum()),
        "val_roc_auc": round(val_roc, 4), "val_pr_auc": round(val_pr, 4), "val_f1": round(val_f1, 4),
        "test_roc_auc": round(test_roc, 4), "test_pr_auc": round(test_pr, 4),
        "test_f1": round(test_f1, 4), "test_precision": round(test_prec, 4),
        "test_recall": round(test_recall, 4),
        "test_confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "cv_roc_auc": round(cv_roc, 4), "cv_pr_auc": round(cv_pr, 4),
        "threshold": round(threshold, 4),
        "n_estimators": n_estimators, "max_depth": max_depth,
    }

    log.info("Training complete — test ROC-AUC: %.4f, F1: %.4f", test_roc, test_f1)

    return {
        "model": model,
        "model_name": "xgboost",
        "threshold": round(threshold, 4),
        "feature_columns": FEATURE_COLUMNS,
        "split_config": SPLIT_CONFIG,
        "metrics": metrics,
        "feature_importance": feat_imp,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Train landslide prediction model")
    parser.add_argument("--n-estimators", type=int, default=150)
    parser.add_argument("--max-depth", type=int, default=5)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--dry-run", action="store_true", help="Print metrics, don't save")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    log.info("Building training data from raw CSVs...")
    df = build_training_data()
    log.info("Loaded %d rows for %d zones", len(df), df["zone_id"].nunique())

    df = generate_flood_labels(df)
    pos_pct = df["flood"].mean() * 100
    log.info("Generated labels — %.1f%% positive (landslide) days", pos_pct)

    bundle = train_flood_model(
        df, n_estimators=args.n_estimators, max_depth=args.max_depth,
        learning_rate=args.learning_rate,
    )

    metrics = bundle["metrics"]
    print()
    print("=" * 55)
    print("  LANDSLIDE MODEL TRAINING REPORT")
    print("=" * 55)
    print(f"  Train rows:    {metrics['train_rows']:>6d}  ({metrics['train_pos']} pos)")
    print(f"  Val rows:      {metrics['val_rows']:>6d}")
    print(f"  Test rows:     {metrics['test_rows']:>6d}")
    print(f"  Threshold:     {metrics['threshold']:.4f}")
    print(f"  Val ROC-AUC:   {metrics['val_roc_auc']:.4f}")
    print(f"  Val PR-AUC:    {metrics['val_pr_auc']:.4f}")
    print(f"  Val F1:        {metrics['val_f1']:.4f}")
    print(f"  Test ROC-AUC:  {metrics['test_roc_auc']:.4f}")
    print(f"  Test PR-AUC:   {metrics['test_pr_auc']:.4f}")
    print(f"  Test F1:       {metrics['test_f1']:.4f}")
    print(f"  Test Prec:     {metrics['test_precision']:.4f}")
    print(f"  Test Recall:   {metrics['test_recall']:.4f}")
    cm = metrics["test_confusion_matrix"]
    print(f"  Confusion:     TN={cm['tn']} FP={cm['fp']} FN={cm['fn']} TP={cm['tp']}")
    print(f"  CV ROC-AUC:    {metrics['cv_roc_auc']:.4f}")
    print(f"  CV PR-AUC:     {metrics['cv_pr_auc']:.4f}")
    print("=" * 55)

    if args.dry_run:
        log.info("Dry run — skipping save")
        return

    models_dir = Path(config.MODELS_DIR)
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "landslide_model.pkl"
    metrics_path = models_dir / "landslide_model_metrics.json"

    save_bundle = {
        "model": bundle["model"],
        "model_name": bundle["model_name"],
        "threshold": bundle["threshold"],
        "feature_columns": bundle["feature_columns"],
        "split_config": bundle["split_config"],
    }
    joblib.dump(save_bundle, model_path)
    log.info("Saved model to %s", model_path)

    with open(metrics_path, "w") as f:
        json.dump(bundle["metrics"], f, indent=2)
    log.info("Saved metrics to %s", metrics_path)


if __name__ == "__main__":
    main()
