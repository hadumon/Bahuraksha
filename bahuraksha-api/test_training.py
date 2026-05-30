"""Tests for the flood model training script."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pytest
import numpy as np
import pandas as pd
import joblib
from train_flood_model import (
    build_training_data,
    generate_flood_labels,
    train_flood_model,
)


class TestBuildTrainingData:
    """Feature engineering from raw CSVs must produce the expected 17 columns."""

    FEATURE_COLUMNS = [
        "rf_1day", "rf_3day", "rf_7day", "rf_30day",
        "discharge_proxy", "soil_moisture_index",
        "sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db",
        "elevation_m", "slope_deg", "aspect_deg", "curvature",
        "month", "day_of_year", "lat", "lon",
    ]

    def test_build_training_data_returns_all_features(self):
        df = build_training_data()
        for col in self.FEATURE_COLUMNS:
            assert col in df.columns, f"Missing feature: {col}"

    def test_build_training_data_has_no_nulls(self):
        df = build_training_data()
        null_cols = [c for c in self.FEATURE_COLUMNS if df[c].isna().any()]
        assert len(null_cols) == 0, f"Columns with nulls: {null_cols}"

    def test_build_training_data_date_range(self):
        df = build_training_data()
        assert df["date"].min() >= pd.Timestamp("2015-01-01")
        assert df["date"].max() <= pd.Timestamp("2025-12-31")


class TestGenerateFloodLabels:
    """Labels should be binary with a plausible positive ratio."""

    def test_labels_are_binary(self):
        df = build_training_data()
        df = generate_flood_labels(df)
        assert set(df["flood"].unique()).issubset({0, 1})

    def test_positive_ratio(self):
        df = build_training_data()
        df = generate_flood_labels(df)
        ratio = df["flood"].mean()
        assert 0.05 <= ratio <= 0.30, f"Positive ratio {ratio:.3f} out of range"

    def test_high_rainfall_days_more_likely_flood(self):
        df = build_training_data()
        df = generate_flood_labels(df)
        high_rain = df[df["rf_3day"] > df["rf_3day"].quantile(0.9)]
        low_rain = df[df["rf_3day"] < df["rf_3day"].quantile(0.1)]
        assert high_rain["flood"].mean() > low_rain["flood"].mean()


class TestTrainFloodModel:
    """Training must produce a valid model bundle."""

    def test_model_bundle_has_required_keys(self):
        df = build_training_data()
        df = generate_flood_labels(df)
        bundle = train_flood_model(df, n_estimators=50, max_depth=4)
        for key in ["model", "model_name", "threshold", "feature_columns", "split_config"]:
            assert key in bundle, f"Missing bundle key: {key}"

    def test_model_has_reasonable_performance(self):
        df = build_training_data()
        df = generate_flood_labels(df)
        bundle = train_flood_model(df, n_estimators=100, max_depth=5)
        metrics = bundle.get("metrics", {})
        roc_auc = metrics.get("test_roc_auc", 0)
        assert roc_auc > 0.7, f"ROC-AUC too low: {roc_auc:.3f}"

    def test_model_predicts_without_error(self):
        df = build_training_data()
        df = generate_flood_labels(df)
        bundle = train_flood_model(df, n_estimators=50, max_depth=4)
        model = bundle["model"]
        X = df[bundle["feature_columns"]].values[:5]
        probs = model.predict_proba(X)[:, 1]
        assert len(probs) == 5
        assert all(0 <= p <= 1 for p in probs)
