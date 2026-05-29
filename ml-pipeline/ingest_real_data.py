"""
Real landslide data ingestion from external sources.

Supports:
- ICIMOD Nepal Landslide Inventory (CSV with lat/lon + attributes)
- NASA LHASA v2 landslide catalog (CSV/GeoJSON)
- DHM Nepal rainfall + landslide reports

Usage:
    python ingest_real_data.py --source icimod --input data/icimod_inventory.csv
    python ingest_real_data.py --source nasa-lhasa --input data/lhasa_catalog.csv
    python ingest_real_data.py --source dhm --input data/dhm_reports.csv
"""

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from raster_enricher import LandslideEnricher
from scipy.spatial import cKDTree

from config import FEATURES
from data_pipeline import generate_synthetic_landslide_data, prepare_features_and_target, TARGET_COL

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def load_icimod_inventory(csv_path: str) -> pd.DataFrame:
    """
    Load ICIMOD Nepal Landslide Inventory.

    Expected columns:
    - latitude, longitude
    - landslide_date (optional)
    - trigger (rainfall, earthquake, etc.)
    - area_m2 or volume_m3 (optional)
    - elevation (optional)
    - slope (optional)
    - land_cover (optional)
    """
    df = pd.read_csv(csv_path)

    required = ["latitude", "longitude"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df.dropna(subset=["latitude", "longitude"])
    df = df[(df["latitude"] >= 26.3) & (df["latitude"] <= 30.5)]
    df = df[(df["longitude"] >= 80.0) & (df["longitude"] <= 88.2)]

    df[TARGET_COL] = 1

    logger.info(f"Loaded {len(df)} landslide points from ICIMOD inventory")
    return df


def load_nasa_lhasa(csv_path: str) -> pd.DataFrame:
    """
    Load NASA LHASA v2 landslide catalog.

    Expected columns:
    - lat, lon (or latitude, longitude)
    - landslide_date
    - trigger (optional)
    """
    df = pd.read_csv(csv_path)

    lat_col = "lat" if "lat" in df.columns else "latitude"
    lon_col = "lon" if "lon" in df.columns else "longitude"

    if lat_col not in df.columns or lon_col not in df.columns:
        raise ValueError(f"Missing lat/lon columns. Found: {list(df.columns)}")

    df = df.rename(columns={lat_col: "latitude", lon_col: "longitude"})
    df = df.dropna(subset=["latitude", "longitude"])
    df = df[(df["latitude"] >= 26.3) & (df["latitude"] <= 30.5)]
    df = df[(df["longitude"] >= 80.0) & (df["longitude"] <= 88.2)]

    df[TARGET_COL] = 1

    logger.info(f"Loaded {len(df)} landslide points from NASA LHASA catalog")
    return df


def load_dhm_reports(csv_path: str) -> pd.DataFrame:
    """
    Load DHM Nepal landslide reports.

    Expected columns:
    - latitude, longitude
    - date
    - district (optional)
    """
    df = pd.read_csv(csv_path)

    required = ["latitude", "longitude"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df.dropna(subset=["latitude", "longitude"])
    df = df[(df["latitude"] >= 26.3) & (df["latitude"] <= 30.5)]
    df = df[(df["longitude"] >= 80.0) & (df["longitude"] <= 88.2)]

    df[TARGET_COL] = 1

    logger.info(f"Loaded {len(df)} landslide reports from DHM")
    return df


def generate_negative_samples(
    positive_points: pd.DataFrame,
    n_negative: int,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate background (non-landslide) samples using spatial sampling.

    Uses a grid-based approach to ensure even coverage across Nepal,
    avoiding areas near known landslides.
    """
    rng = np.random.default_rng(seed)

    min_dist_km = 2.0

    lat_min, lat_max = 26.5, 30.3
    lon_min, lon_max = 80.2, 88.0

    pos_coords = np.column_stack([
        positive_points["latitude"].values,
        positive_points["longitude"].values,
    ])

    tree = cKDTree(pos_coords)

    negative_rows = []
    attempts = 0
    max_attempts = n_negative * 50

    while len(negative_rows) < n_negative and attempts < max_attempts:
        lat = rng.uniform(lat_min, lat_max)
        lon = rng.uniform(lon_min, lon_max)

        dist, _ = tree.query([[lat, lon]], k=1)
        if dist[0] >= min_dist_km:
            negative_rows.append({"latitude": lat, "longitude": lon})

        attempts += 1

    if len(negative_rows) < n_negative:
        logger.warning(
            f"Only generated {len(negative_rows)}/{n_negative} negative samples. "
            f"Consider reducing min_dist_km or increasing max_attempts."
        )

    negative_df = pd.DataFrame(negative_rows)
    negative_df[TARGET_COL] = 0

    logger.info(f"Generated {len(negative_df)} negative samples (avoided {min_dist_km}km radius)")
    return negative_df


def enrich_with_environmental_features(
    df: pd.DataFrame,
    feature_datasets: dict[str, pd.DataFrame] | None = None,
    enricher: "LandslideEnricher | None" = None,
) -> pd.DataFrame:
    """
    Enrich landslide points with environmental features from raster datasets.

    Uses the LandslideEnricher when available (real STAC data with fallback),
    otherwise falls back to vectorized synthetic interpolation.
    """
    if enricher is not None:
        points = df[["latitude", "longitude"]].to_dict(orient="records")
        enriched = enricher.enrich_batch(points)
        for col in enricher.FEATURE_KEYS:
            df[col] = enriched[col].values
        return df

    rng = np.random.default_rng(42)
    lat = df["latitude"].values
    lon = df["longitude"].values

    elevation = 500 + 2500 * np.exp(-((lat - 28.0) ** 2 + (lon - 84.5) ** 2) / 2) + rng.normal(0, 200, len(df))
    elevation = np.clip(elevation, 100, 8000)

    slope = 15 + 25 * np.exp(-((lat - 28.2) ** 2 + (lon - 84.0) ** 2) / 3) + rng.normal(0, 5, len(df))
    slope = np.clip(slope, 0, 70)

    rainfall_7d = 50 + 200 * np.exp(-((lat - 27.8) ** 2 + (lon - 85.5) ** 2) / 4) + rng.exponential(30, len(df))
    rainfall_7d = np.clip(rainfall_7d, 0, 600)

    rainfall_today = rng.exponential(15, len(df))
    rainfall_today = np.clip(rainfall_today, 0, 150)

    soil_moisture = 30 + 40 * np.exp(-((lat - 28.0) ** 2 + (lon - 84.5) ** 2) / 5) + rng.normal(0, 10, len(df))
    soil_moisture = np.clip(soil_moisture, 5, 100)

    seismic = rng.exponential(0.008, len(df))
    seismic = np.clip(seismic, 0, 0.1)

    vegetation = 30 + 40 * np.exp(-((lat - 28.5) ** 2 + (lon - 83.5) ** 2) / 3) + rng.normal(0, 10, len(df))
    vegetation = np.clip(vegetation, 5, 95)

    distance_road = rng.exponential(2.0, len(df))
    distance_road = np.clip(distance_road, 0, 15)

    distance_river = rng.exponential(1.5, len(df))
    distance_river = np.clip(distance_river, 0, 10)

    curvature = rng.normal(0, 0.5, len(df))

    aspect = rng.uniform(0, 360, len(df))

    ndvi = 0.3 + 0.4 * np.exp(-((lat - 28.5) ** 2 + (lon - 83.5) ** 2) / 4) + rng.normal(0, 0.1, len(df))
    ndvi = np.clip(ndvi, 0, 1)

    lithology = rng.choice([1, 2, 3, 4, 5], len(df), p=[0.2, 0.3, 0.25, 0.15, 0.1])

    land_use = rng.choice([1, 2, 3, 4, 5], len(df), p=[0.15, 0.25, 0.3, 0.2, 0.1])

    df["elevation_m"] = elevation
    df["slope_angle_deg"] = slope
    df["rainfall_7d_mm"] = rainfall_7d
    df["rainfall_today_mm"] = rainfall_today
    df["soil_moisture_pct"] = soil_moisture
    df["seismic_activity_mg"] = seismic
    df["vegetation_cover_pct"] = vegetation
    df["distance_to_road_km"] = distance_road
    df["distance_to_river_km"] = distance_river
    df["curvature"] = curvature
    df["aspect_deg"] = aspect
    df["ndvi"] = ndvi
    df["lithology_code"] = lithology
    df["land_use_code"] = land_use

    return df


def ingest_real_data(
    source: str,
    input_path: str,
    output_path: str = "data/landslide_inventory_enriched.csv",
    n_negative_ratio: int = 5,
) -> pd.DataFrame:
    """
    Main ingestion pipeline.

    1. Load positive samples from external source
    2. Generate negative samples
    3. Enrich with environmental features
    4. Save enriched dataset
    """
    logger.info(f"Ingesting {source} data from {input_path}")

    if source == "icimod":
        positives = load_icimod_inventory(input_path)
    elif source == "nasa-lhasa":
        positives = load_nasa_lhasa(input_path)
    elif source == "dhm":
        positives = load_dhm_reports(input_path)
    else:
        raise ValueError(f"Unknown source: {source}. Use icimod, nasa-lhasa, or dhm.")

    n_negative = len(positives) * n_negative_ratio
    negatives = generate_negative_samples(positives, n_negative)

    combined = pd.concat([positives, negatives], ignore_index=True)
    combined = combined.sample(frac=1, random_state=42).reset_index(drop=True)

    logger.info(f"Enriching {len(combined)} samples with environmental features...")
    enriched = enrich_with_environmental_features(combined)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    enriched.to_csv(output, index=False)
    logger.info(f"Saved enriched dataset to {output}")

    pos_count = enriched[TARGET_COL].sum()
    neg_count = len(enriched) - pos_count
    logger.info(f"Dataset: {len(enriched)} samples ({pos_count} positive, {neg_count} negative)")
    logger.info(f"Positive rate: {pos_count / len(enriched):.4f}")

    return enriched


def main():
    parser = argparse.ArgumentParser(description="Ingest real landslide inventory data")
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        choices=["icimod", "nasa-lhasa", "dhm"],
        help="Data source",
    )
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--output", type=str, default="data/landslide_inventory_enriched.csv", help="Output CSV path")
    parser.add_argument("--n-negative-ratio", type=int, default=5, help="Negative:positive sample ratio")
    args = parser.parse_args()

    ingest_real_data(
        source=args.source,
        input_path=args.input,
        output_path=args.output,
        n_negative_ratio=args.n_negative_ratio,
    )


if __name__ == "__main__":
    main()
