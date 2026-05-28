import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.base import BaseEstimator, TransformerMixin
from typing import Optional


class LandslideFeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Domain-specific feature engineering for landslide susceptibility.

    Creates physically-motivated interaction features that capture known
    landslide triggering mechanisms:
    - Rainfall-soil saturation coupling
    - Slope-vegetation stability interaction
    - Seismic-slope amplification
    - Topographic wetness index approximation
    """

    def __init__(self, add_interactions: bool = True, scale: bool = True):
        self.add_interactions = add_interactions
        self.scale = scale
        self.scaler: Optional[StandardScaler] = None
        self.feature_names_out_: list[str] = []

    def fit(self, X: pd.DataFrame, y=None):
        if self.add_interactions:
            X_aug = self._add_interactions(X)
        else:
            X_aug = X

        if self.scale:
            self.scaler = StandardScaler()
            self.scaler.fit(X_aug)

        self.feature_names_out_ = list(X.columns)
        if self.add_interactions:
            self.feature_names_out_.extend([
                "rainfall_soil_coupling",
                "slope_vegetation_interaction",
                "seismic_slope_amplification",
                "topographic_wetness_idx",
                "road_slope_interaction",
                "elevation_rainfall_interaction",
            ])
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if self.add_interactions:
            X = self._add_interactions(X)

        if self.scale:
            values = self.scaler.transform(X)
        else:
            values = X.values

        return values.astype(np.float32)

    def _add_interactions(self, X: pd.DataFrame) -> pd.DataFrame:
        X = X.copy()
        X["rainfall_soil_coupling"] = (
            X["rainfall_7d_mm"] * X["soil_moisture_pct"] / 100
        )
        X["slope_vegetation_interaction"] = (
            X["slope_angle_deg"] * (1 - X["vegetation_cover_pct"] / 100)
        )
        X["seismic_slope_amplification"] = (
            X["seismic_activity_mg"] * X["slope_angle_deg"] / 30
        )
        X["topographic_wetness_idx"] = np.log1p(
            X["rainfall_today_mm"] * X["soil_moisture_pct"] /
            (np.tan(np.radians(X["slope_angle_deg"].clip(1, 89))) + 0.01)
        )
        X["road_slope_interaction"] = (
            X["slope_angle_deg"] / (X["distance_to_road_km"] + 0.1)
        )
        X["elevation_rainfall_interaction"] = (
            X["elevation_m"] * X["rainfall_7d_mm"] / 1000
        )
        return X

    def get_feature_names_out(self) -> list[str]:
        return self.feature_names_out_
