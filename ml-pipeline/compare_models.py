"""
Model comparison script: synthetic vs real vs hybrid.

Usage:
    python compare_models.py
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from config import MODEL_CONFIG
from data_pipeline import generate_synthetic_landslide_data, load_real_data, prepare_features_and_target
from feature_engineering import LandslideFeatureEngineer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def train_and_evaluate(name: str, df: pd.DataFrame, output_dir: str = "models") -> dict:
    """Train a model and return evaluation metrics."""
    logger.info(f"\n{'='*60}")
    logger.info(f"Training: {name}")
    logger.info(f"Samples: {len(df)}, Positive rate: {df['landslide_occurrence'].mean():.4f}")

    X_raw, y = prepare_features_and_target(df)
    engineer = LandslideFeatureEngineer(add_interactions=True, scale=True)
    X = engineer.fit_transform(X_raw)

    import xgboost as xgb
    from sklearn.model_selection import StratifiedKFold, cross_validate
    from sklearn.calibration import CalibratedClassifierCV

    base_model = xgb.XGBClassifier(**MODEL_CONFIG["xgboost"])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_results = cross_validate(
        base_model, X, y, cv=cv,
        scoring=["roc_auc", "average_precision", "f1", "precision", "recall"],
        return_train_score=True,
        n_jobs=-1,
    )

    base_model.fit(X, y)
    calibrated = CalibratedClassifierCV(
        base_model,
        method=MODEL_CONFIG["calibration"]["method"],
        cv=MODEL_CONFIG["calibration"]["cv_folds"],
    )
    calibrated.fit(X, y)

    train_pred = calibrated.predict_proba(X)[:, 1]
    thresholds = MODEL_CONFIG["thresholds"]
    y_pred = np.where(train_pred >= thresholds["watch"], 1, 0)

    from sklearn.metrics import roc_auc_score, average_precision_score, f1_score, accuracy_score

    metrics = {
        "name": name,
        "n_samples": len(df),
        "n_positive": int(y.sum()),
        "positive_rate": float(y.mean()),
        "cv_roc_auc": float(cv_results["test_roc_auc"].mean()),
        "cv_roc_auc_std": float(cv_results["test_roc_auc"].std()),
        "cv_avg_precision": float(cv_results["test_average_precision"].mean()),
        "cv_f1": float(cv_results["test_f1"].mean()),
        "cv_precision": float(cv_results["test_precision"].mean()),
        "cv_recall": float(cv_results["test_recall"].mean()),
        "train_roc_auc": float(roc_auc_score(y, train_pred)),
        "train_avg_precision": float(average_precision_score(y, train_pred)),
        "train_f1": float(f1_score(y, y_pred)),
        "train_accuracy": float(accuracy_score(y, y_pred)),
    }

    for k, v in metrics.items():
        if isinstance(v, float):
            logger.info(f"  {k}: {v:.4f}")
        else:
            logger.info(f"  {k}: {v}")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    artifacts = {
        "calibrated_model": calibrated,
        "base_model": base_model,
        "engineer": engineer,
        "feature_names": engineer.get_feature_names_out(),
        "metrics": metrics,
        "thresholds": thresholds,
    }
    joblib.dump(artifacts, output_path / f"landslide_model_{name.replace(' ', '_').lower()}.joblib")

    return metrics


def main():
    logger.info("Loading datasets...")

    synth_df = generate_synthetic_landslide_data(n_samples=50000, seed=42)

    real_df = None
    real_path = Path("data/landslide_inventory_enriched.csv")
    if real_path.exists():
        real_df = load_real_data(str(real_path))
        logger.info(f"Real data: {len(real_df)} samples")

    results = []

    results.append(train_and_evaluate("Synthetic", synth_df))

    if real_df is not None:
        results.append(train_and_evaluate("Real", real_df))

        combined = pd.concat([real_df, synth_df[:len(real_df) * 20]], ignore_index=True)
        combined = combined.sample(frac=1, random_state=42).reset_index(drop=True)
        results.append(train_and_evaluate("Hybrid", combined))

    logger.info(f"\n{'='*60}")
    logger.info("MODEL COMPARISON SUMMARY")
    logger.info(f"{'='*60}")

    header = f"{'Model':<12} {'Samples':>8} {'Pos Rate':>9} {'CV AUC':>8} {'CV F1':>8} {'CV Prec':>8} {'CV Rec':>8}"
    logger.info(header)
    logger.info("-" * len(header))

    for m in results:
        row = (
            f"{m['name']:<12} "
            f"{m['n_samples']:>8} "
            f"{m['positive_rate']:>9.4f} "
            f"{m['cv_roc_auc']:>8.4f} "
            f"{m['cv_f1']:>8.4f} "
            f"{m['cv_precision']:>8.4f} "
            f"{m['cv_recall']:>8.4f}"
        )
        logger.info(row)

    best = max(results, key=lambda m: m["cv_roc_auc"])
    logger.info(f"\nBest model by CV ROC-AUC: {best['name']} ({best['cv_roc_auc']:.4f})")

    summary_path = Path("models/model_comparison.json")
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info(f"Comparison saved to {summary_path}")


if __name__ == "__main__":
    main()
