import json
import logging
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import (
    roc_curve,
    precision_recall_curve,
    confusion_matrix,
    classification_report,
    RocCurveDisplay,
    PrecisionRecallDisplay,
)

from config import MODEL_CONFIG
from data_pipeline import generate_synthetic_landslide_data, prepare_features_and_target

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def evaluate(model_path: str = "models/landslide_model.joblib", output_dir: str = "models"):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading model from {model_path}")
    artifacts = joblib.load(model_path)

    logger.info("Generating evaluation dataset...")
    df = generate_synthetic_landslide_data(n_samples=20000, seed=123)
    X_raw, y = prepare_features_and_target(df)

    engineer = artifacts["engineer"]
    X = engineer.transform(X_raw)

    calibrated = artifacts["calibrated_model"]
    y_pred_proba = calibrated.predict_proba(X)[:, 1]
    thresholds = artifacts["thresholds"]

    y_pred_watch = (y_pred_proba >= thresholds["watch"]).astype(int)

    logger.info("\nClassification Report (watch threshold):")
    report = classification_report(y, y_pred_watch, output_dict=True)
    print(classification_report(y, y_pred_watch))

    cm = confusion_matrix(y, y_pred_watch)
    logger.info(f"\nConfusion Matrix:\n{cm}")

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    RocCurveDisplay.from_predictions(y, y_pred_proba, ax=axes[0, 0])
    axes[0, 0].set_title("ROC Curve")

    PrecisionRecallDisplay.from_predictions(y, y_pred_proba, ax=axes[0, 1])
    axes[0, 1].set_title("Precision-Recall Curve")

    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=axes[1, 0],
                xticklabels=["No Landslide", "Landslide"],
                yticklabels=["No Landslide", "Landslide"])
    axes[1, 0].set_title("Confusion Matrix")
    axes[1, 0].set_ylabel("Actual")
    axes[1, 0].set_xlabel("Predicted")

    importance_df = artifacts.get("feature_importance", [])
    if importance_df:
        names = [item["feature"] for item in importance_df[:15]]
        values = [item["importance"] for item in importance_df[:15]]
        axes[1, 1].barh(names[::-1], values[::-1], color="steelblue")
        axes[1, 1].set_title("Feature Importance (Top 15)")
        axes[1, 1].set_xlabel("Importance")

    plt.tight_layout()
    eval_path = output_path / "evaluation_report.png"
    fig.savefig(eval_path, dpi=150, bbox_inches="tight")
    plt.close()
    logger.info(f"Evaluation report saved to {eval_path}")

    prob_bins = np.linspace(0, 1, 21)
    bin_centers = (prob_bins[:-1] + prob_bins[1:]) / 2
    bin_rates = []
    for i in range(len(prob_bins) - 1):
        mask = (y_pred_proba >= prob_bins[i]) & (y_pred_proba < prob_bins[i + 1])
        if mask.sum() > 0:
            bin_rates.append(float(y[mask].mean()))
        else:
            bin_rates.append(None)

    calibration_data = {
        "bin_centers": bin_centers.tolist(),
        "observed_rates": bin_rates,
    }

    calibration_path = output_path / "calibration.json"
    with open(calibration_path, "w") as f:
        json.dump(calibration_data, f, indent=2)
    logger.info(f"Calibration data saved to {calibration_path}")

    return report


if __name__ == "__main__":
    evaluate()
