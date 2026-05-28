import numpy as np
import pandas as pd
from typing import Optional
from scipy.stats import truncnorm

from config import FEATURES, NEPAL_REGION


def generate_synthetic_landslide_data(
    n_samples: int = 10000,
    landslide_ratio: float = 0.15,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate synthetic landslide dataset with realistic feature distributions
    and physically-informed labels for the Nepal/Himalayan region.

    The label generation uses a probabilistic model based on known landslide
    susceptibility factors, ensuring the synthetic data has learnable patterns.
    """
    rng = np.random.default_rng(seed)

    data = _generate_background_samples(n_samples, rng)

    logit = (
        -4.0
        + 0.06 * data["slope_angle_deg"]
        + 0.03 * data["soil_moisture_pct"]
        + 0.012 * data["rainfall_7d_mm"]
        + 0.04 * data["rainfall_today_mm"]
        + 15.0 * data["seismic_activity_mg"]
        - 0.025 * data["vegetation_cover_pct"]
        + 0.0004 * data["elevation_m"]
        - 0.35 * data["distance_to_road_km"]
        - 0.5 * data["distance_to_river_km"]
        + 0.5 * data["curvature"]
        - 0.8 * data["ndvi"]
        + 0.3 * (data["lithology_code"] - 3)
        + 0.2 * (data["land_use_code"] - 3)
    )

    prob = 1 / (1 + np.exp(-logit))

    target_scale = landslide_ratio / prob.mean()
    logit_adjusted = logit + np.log(target_scale)
    prob_adjusted = 1 / (1 + np.exp(-logit_adjusted))
    prob_adjusted = np.clip(prob_adjusted, 0.001, 0.999)

    data[TARGET_COL] = (rng.random(n_samples) < prob_adjusted).astype(int)

    data = data.sample(frac=1, random_state=seed).reset_index(drop=True)

    for feature in FEATURES:
        if feature in data.columns:
            data[feature] = data[feature].astype(np.float32)

    return data


TARGET_COL = "landslide_occurrence"


def _generate_background_samples(n: int, rng: np.random.Generator) -> pd.DataFrame:
    slope = rng.exponential(18, n).clip(0, 70)
    elevation = rng.uniform(200, 4000, n)
    rainfall_7d = rng.exponential(40, n).clip(0, 500)
    rainfall_today = rng.exponential(8, n).clip(0, 100)
    soil_moisture = rng.beta(2, 3, n) * 100
    seismic = rng.exponential(0.003, n).clip(0, 0.1)
    vegetation = rng.beta(3, 2, n) * 100
    distance_road = rng.exponential(3, n).clip(0, 15)
    distance_river = rng.exponential(2, n).clip(0, 10)
    curvature = rng.normal(0, 0.5, n)
    aspect = rng.uniform(0, 360, n)
    ndvi = rng.beta(4, 2, n)
    lithology = rng.choice([1, 2, 3, 4, 5], n, p=[0.2, 0.3, 0.25, 0.15, 0.1])
    land_use = rng.choice([1, 2, 3, 4, 5], n, p=[0.15, 0.25, 0.3, 0.2, 0.1])

    return pd.DataFrame({
        "slope_angle_deg": slope,
        "soil_moisture_pct": soil_moisture,
        "rainfall_7d_mm": rainfall_7d,
        "rainfall_today_mm": rainfall_today,
        "seismic_activity_mg": seismic,
        "vegetation_cover_pct": vegetation,
        "elevation_m": elevation,
        "distance_to_road_km": distance_road,
        "distance_to_river_km": distance_river,
        "curvature": curvature,
        "aspect_deg": aspect,
        "ndvi": ndvi,
        "lithology_code": lithology,
        "land_use_code": land_use,
    })





def load_real_data(csv_path: str) -> pd.DataFrame:
    """
    Load real landslide inventory data from CSV.

    Expected columns:
    - latitude, longitude
    - slope_angle_deg, soil_moisture_pct, rainfall_7d_mm, rainfall_today_mm
    - seismic_activity_mg, vegetation_cover_pct, elevation_m
    - distance_to_road_km, distance_to_river_km
    - curvature, aspect_deg, ndvi, lithology_code, land_use_code
    - landslide_occurrence (0 or 1)
    """
    df = pd.read_csv(csv_path)

    required = [TARGET_COL] + FEATURES
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df.dropna(subset=required)

    for feature in FEATURES:
        df[feature] = pd.to_numeric(df[feature], errors="coerce")

    df = df.dropna(subset=FEATURES)
    df[TARGET_COL] = df[TARGET_COL].astype(int)

    return df


def prepare_features_and_target(
    df: pd.DataFrame,
    feature_cols: Optional[list[str]] = None,
) -> tuple[pd.DataFrame, pd.Series]:
    cols = feature_cols or FEATURES
    X = df[cols].copy()
    y = df[TARGET_COL]
    return X, y
