import argparse
import json
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    classification_report,
)

from config import MODEL_CONFIG, FEATURES
from data_pipeline import generate_synthetic_landslide_data, load_real_data, prepare_features_and_target
from feature_engineering import LandslideFeatureEngineer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def train(
    data_path: str | None = None,
    output_dir: str = "models",
    use_synthetic: bool = True,
    n_samples: int = 50000,
    augment_real: bool = False,
    augment_ratio: int = 10,
):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    logger.info("Loading data...")
    real_df = None
    if data_path and Path(data_path).exists():
        real_df = load_real_data(data_path)
        logger.info(f"Loaded real data: {len(real_df)} samples, {real_df['landslide_occurrence'].sum()} positives")

    if augment_real and real_df is not None:
        logger.info(f"Augmenting real data with {augment_ratio}x synthetic samples...")
        n_synth = len(real_df) * augment_ratio
        synth_df = generate_synthetic_landslide_data(n_samples=n_synth)
        df = pd.concat([real_df, synth_df], ignore_index=True)
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
        logger.info(f"Combined dataset: {len(df)} samples ({len(real_df)} real + {n_synth} synthetic)")
    elif real_df is not None:
        df = real_df
    elif use_synthetic:
        df = generate_synthetic_landslide_data(n_samples=n_samples)
        logger.info(f"Generated synthetic data: {len(df)} samples, {df['landslide_occurrence'].sum()} positives")
    else:
        logger.error("No data source specified. Provide --data-path or use --synthetic.")
        sys.exit(1)

    X_raw, y = prepare_features_and_target(df)

    logger.info("Engineering features...")
    engineer = LandslideFeatureEngineer(add_interactions=True, scale=True)
    X = engineer.fit_transform(X_raw)

    logger.info(f"Feature matrix shape: {X.shape}")
    logger.info(f"Positive rate: {y.mean():.4f}")

    logger.info("Training XGBoost model with cross-validation...")
    base_model = xgb.XGBClassifier(**MODEL_CONFIG["xgboost"])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_results = cross_validate(
        base_model, X, y, cv=cv,
        scoring=["roc_auc", "average_precision", "f1", "precision", "recall"],
        return_train_score=True,
        n_jobs=-1,
    )

    metrics = {
        "cv_roc_auc_mean": float(cv_results["test_roc_auc"].mean()),
        "cv_roc_auc_std": float(cv_results["test_roc_auc"].std()),
        "cv_avg_precision_mean": float(cv_results["test_average_precision"].mean()),
        "cv_f1_mean": float(cv_results["test_f1"].mean()),
        "cv_precision_mean": float(cv_results["test_precision"].mean()),
        "cv_recall_mean": float(cv_results["test_recall"].mean()),
    }

    logger.info("Cross-validation results:")
    for k, v in metrics.items():
        logger.info(f"  {k}: {v:.4f}")

    logger.info("Fitting final model on full training data...")
    base_model.fit(X, y)

    logger.info("Calibrating probabilities...")
    calibrated = CalibratedClassifierCV(
        base_model,
        method=MODEL_CONFIG["calibration"]["method"],
        cv=MODEL_CONFIG["calibration"]["cv_folds"],
    )
    calibrated.fit(X, y)

    train_pred = calibrated.predict_proba(X)[:, 1]
    train_metrics = {
        "train_roc_auc": float(roc_auc_score(y, train_pred)),
        "train_avg_precision": float(average_precision_score(y, train_pred)),
        "train_f1": float(f1_score(y, calibrated.predict(X))),
    }
    logger.info("Training metrics:")
    for k, v in train_metrics.items():
        logger.info(f"  {k}: {v:.4f}")

    feature_names = engineer.get_feature_names_out()
    importance = base_model.feature_importances_
    importance_df = pd.DataFrame({
        "feature": feature_names,
        "importance": importance,
    }).sort_values("importance", ascending=False)

    logger.info("Feature importance (top 10):")
    logger.info(importance_df.head(10).to_string(index=False))

    thresholds = MODEL_CONFIG["thresholds"]
    y_pred_proba = train_pred
    y_pred = np.where(y_pred_proba >= thresholds["watch"], 1, 0)

    cm = confusion_matrix(y, y_pred)
    report = classification_report(y, y_pred, output_dict=True)

    logger.info("Saving model artifacts...")
    artifacts = {
        "calibrated_model": calibrated,
        "base_model": base_model,
        "engineer": engineer,
        "feature_names": feature_names,
        "importance": importance_df.to_dict(orient="records"),
        "metrics": {**metrics, **train_metrics},
        "thresholds": thresholds,
        "feature_importance": importance_df.head(20).to_dict(orient="records"),
    }

    model_path = output_path / "landslide_model.joblib"
    joblib.dump(artifacts, model_path)
    logger.info(f"Model saved to {model_path}")

    metadata = {
        "model_type": "XGBoost + Isotonic Calibration",
        "n_features": len(feature_names),
        "feature_names": feature_names,
        "n_training_samples": len(y),
        "positive_rate": float(y.mean()),
        "metrics": {**metrics, **train_metrics},
        "thresholds": thresholds,
        "feature_importance": importance_df.head(20).to_dict(orient="records"),
        "config": MODEL_CONFIG,
    }

    metadata_path = output_path / "model_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    logger.info(f"Metadata saved to {metadata_path}")

    return artifacts, metrics


def main():
    parser = argparse.ArgumentParser(description="Train landslide prediction model")
    parser.add_argument("--data-path", type=str, default=None, help="Path to CSV with real data")
    parser.add_argument("--output-dir", type=str, default="models", help="Output directory for model")
    parser.add_argument("--no-synthetic", action="store_true", help="Disable synthetic data fallback")
    parser.add_argument("--n-samples", type=int, default=50000, help="Synthetic sample count")
    parser.add_argument("--augment-real", action="store_true", help="Augment real data with synthetic samples")
    parser.add_argument("--augment-ratio", type=int, default=10, help="Synthetic:real ratio for augmentation")
    args = parser.parse_args()

    train(
        data_path=args.data_path,
        output_dir=args.output_dir,
        use_synthetic=not args.no_synthetic,
        n_samples=args.n_samples,
        augment_real=args.augment_real,
        augment_ratio=args.augment_ratio,
    )


if __name__ == "__main__":
    main()
