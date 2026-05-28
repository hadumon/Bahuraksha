import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
import pytest

from data_pipeline import generate_synthetic_landslide_data, prepare_features_and_target, TARGET_COL
from feature_engineering import LandslideFeatureEngineer
from config import FEATURES


class TestDataPipeline:
    def test_generate_synthetic_data_shape(self):
        df = generate_synthetic_landslide_data(n_samples=1000, seed=42)
        assert len(df) == 1000
        assert TARGET_COL in df.columns
        for feature in FEATURES:
            assert feature in df.columns

    def test_landslide_ratio(self):
        df = generate_synthetic_landslide_data(n_samples=10000, landslide_ratio=0.08, seed=42)
        positive_rate = df[TARGET_COL].mean()
        assert 0.06 < positive_rate < 0.10

    def test_feature_ranges(self):
        df = generate_synthetic_landslide_data(n_samples=1000, seed=42)
        assert df["slope_angle_deg"].between(0, 70).all()
        assert df["soil_moisture_pct"].between(0, 100).all()
        assert (df["rainfall_7d_mm"] >= 0).all()
        assert (df["rainfall_today_mm"] >= 0).all()
        assert (df["seismic_activity_mg"] >= 0).all()
        assert df["vegetation_cover_pct"].between(0, 100).all()
        assert (df["elevation_m"] >= 0).all()
        assert (df["distance_to_road_km"] >= 0).all()

    def test_prepare_features_and_target(self):
        df = generate_synthetic_landslide_data(n_samples=500, seed=42)
        X, y = prepare_features_and_target(df)
        assert X.shape[1] == len(FEATURES)
        assert len(y) == len(X)
        assert set(y.unique()).issubset({0, 1})


class TestFeatureEngineering:
    def test_engineer_transform_shape(self):
        df = generate_synthetic_landslide_data(n_samples=100, seed=42)
        X_raw, _ = prepare_features_and_target(df)

        engineer = LandslideFeatureEngineer(add_interactions=True, scale=True)
        X = engineer.fit_transform(X_raw)

        assert X.shape[0] == 100
        assert X.shape[1] == len(FEATURES) + 6

    def test_engineer_no_interactions(self):
        df = generate_synthetic_landslide_data(n_samples=100, seed=42)
        X_raw, _ = prepare_features_and_target(df)

        engineer = LandslideFeatureEngineer(add_interactions=False, scale=True)
        X = engineer.fit_transform(X_raw)

        assert X.shape[1] == len(FEATURES)

    def test_engineer_no_scaling(self):
        df = generate_synthetic_landslide_data(n_samples=100, seed=42)
        X_raw, _ = prepare_features_and_target(df)

        engineer = LandslideFeatureEngineer(add_interactions=True, scale=False)
        X = engineer.fit_transform(X_raw)

        assert X.shape[1] == len(FEATURES) + 6

    def test_feature_names_out(self):
        df = generate_synthetic_landslide_data(n_samples=100, seed=42)
        X_raw, _ = prepare_features_and_target(df)

        engineer = LandslideFeatureEngineer(add_interactions=True, scale=True)
        engineer.fit(X_raw)

        names = engineer.get_feature_names_out()
        assert "rainfall_soil_coupling" in names
        assert "slope_vegetation_interaction" in names
        assert "seismic_slope_amplification" in names
        assert "topographic_wetness_idx" in names


class TestModelTraining:
    def test_model_trains_and_predicts(self):
        import joblib
        import xgboost as xgb
        from config import MODEL_CONFIG

        df = generate_synthetic_landslide_data(n_samples=5000, seed=42)
        X_raw, y = prepare_features_and_target(df)

        engineer = LandslideFeatureEngineer(add_interactions=True, scale=True)
        X = engineer.fit_transform(X_raw)

        model = xgb.XGBClassifier(**MODEL_CONFIG["xgboost"])
        model.fit(X, y)

        preds = model.predict(X)
        proba = model.predict_proba(X)

        assert len(preds) == len(y)
        assert proba.shape == (len(y), 2)
        assert set(np.unique(preds)).issubset({0, 1})

    def test_feature_importance(self):
        import xgboost as xgb
        from config import MODEL_CONFIG

        df = generate_synthetic_landslide_data(n_samples=5000, seed=42)
        X_raw, y = prepare_features_and_target(df)

        engineer = LandslideFeatureEngineer(add_interactions=True, scale=True)
        X = engineer.fit_transform(X_raw)

        model = xgb.XGBClassifier(**MODEL_CONFIG["xgboost"])
        model.fit(X, y)

        importance = model.feature_importances_
        assert len(importance) == X.shape[1]
        assert importance.sum() > 0
        assert (importance >= 0).all()
