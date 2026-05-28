"""
Data quality validation for landslide inventory datasets.

Checks:
- Required columns present
- Value ranges valid
- No duplicate coordinates
- Spatial distribution reasonable
- Class balance acceptable
- Missing value rates

Usage:
    python validate_data.py --input data/landslide_inventory_enriched.csv
    python validate_data.py --input data/icimod_inventory.csv
"""

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


REQUIRED_COLUMNS = ["latitude", "longitude", "landslide_occurrence"]

FEATURE_COLUMNS = [
    "slope_angle_deg", "soil_moisture_pct", "rainfall_7d_mm", "rainfall_today_mm",
    "seismic_activity_mg", "vegetation_cover_pct", "elevation_m",
    "distance_to_road_km", "distance_to_river_km", "curvature",
    "aspect_deg", "ndvi", "lithology_code", "land_use_code",
]

VALUE_RANGES = {
    "latitude": (26.0, 31.0),
    "longitude": (80.0, 89.0),
    "slope_angle_deg": (0, 90),
    "soil_moisture_pct": (0, 100),
    "rainfall_7d_mm": (0, 1000),
    "rainfall_today_mm": (0, 500),
    "seismic_activity_mg": (0, 1),
    "vegetation_cover_pct": (0, 100),
    "elevation_m": (0, 9000),
    "distance_to_road_km": (0, 50),
    "distance_to_river_km": (0, 50),
    "curvature": (-5, 5),
    "aspect_deg": (0, 360),
    "ndvi": (0, 1),
    "lithology_code": (1, 5),
    "land_use_code": (1, 5),
}


def validate_data(csv_path: str) -> dict:
    """Run data quality checks and return report."""
    logger.info(f"Validating: {csv_path}")
    df = pd.read_csv(csv_path)

    report = {
        "file": csv_path,
        "n_rows": len(df),
        "n_columns": len(df.columns),
        "checks": {},
        "passed": True,
    }

    # Check required columns
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    report["checks"]["required_columns"] = {
        "passed": len(missing) == 0,
        "detail": f"Missing: {missing}" if missing else "All present",
    }
    if missing:
        report["passed"] = False

    # Check value ranges
    range_issues = []
    for col, (min_val, max_val) in VALUE_RANGES.items():
        if col in df.columns:
            out_of_range = ((df[col] < min_val) | (df[col] > max_val)).sum()
            if out_of_range > 0:
                range_issues.append(f"{col}: {out_of_range} values outside [{min_val}, {max_val}]")

    report["checks"]["value_ranges"] = {
        "passed": len(range_issues) == 0,
        "detail": "; ".join(range_issues) if range_issues else "All values in valid ranges",
    }
    if range_issues:
        report["passed"] = False

    # Check duplicates
    coord_pairs = df[["latitude", "longitude"]].drop_duplicates()
    n_duplicates = len(df) - len(coord_pairs)
    report["checks"]["duplicate_coordinates"] = {
        "passed": n_duplicates == 0,
        "detail": f"{n_duplicates} duplicate coordinate pairs" if n_duplicates > 0 else "No duplicates",
    }

    # Check spatial distribution
    if "latitude" in df.columns and "longitude" in df.columns:
        coords = df[["latitude", "longitude"]].values
        tree = cKDTree(coords)
        min_distances, _ = tree.query(coords, k=2)
        min_dist = min_distances[:, 1].min()
        mean_dist = min_distances[:, 1].mean()

        report["checks"]["spatial_distribution"] = {
            "passed": min_dist > 0.001,
            "detail": f"Min distance: {min_dist:.4f}°, Mean nearest: {mean_dist:.4f}°",
        }

    # Check class balance
    if "landslide_occurrence" in df.columns:
        pos_count = df["landslide_occurrence"].sum()
        neg_count = len(df) - pos_count
        pos_rate = pos_count / len(df)

        report["checks"]["class_balance"] = {
            "passed": 0.01 <= pos_rate <= 0.5,
            "detail": f"Positive: {pos_count} ({pos_rate:.4f}), Negative: {neg_count} ({1-pos_rate:.4f})",
        }
        if pos_rate < 0.01 or pos_rate > 0.5:
            report["passed"] = False

    # Check missing values
    missing_counts = df.isnull().sum()
    missing_pct = (missing_counts / len(df) * 100).round(2)
    cols_with_missing = missing_counts[missing_counts > 0]

    report["checks"]["missing_values"] = {
        "passed": len(cols_with_missing) == 0,
        "detail": cols_with_missing.to_dict() if len(cols_with_missing) > 0 else "No missing values",
    }

    # Summary statistics
    report["summary_stats"] = {}
    for col in FEATURE_COLUMNS:
        if col in df.columns:
            report["summary_stats"][col] = {
                "mean": float(df[col].mean()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "median": float(df[col].median()),
            }

    return report


def main():
    parser = argparse.ArgumentParser(description="Validate landslide inventory data quality")
    parser.add_argument("--input", type=str, required=True, help="Input CSV path")
    parser.add_argument("--output", type=str, default=None, help="Output JSON report path")
    args = parser.parse_args()

    report = validate_data(args.input)

    logger.info(f"\n{'='*60}")
    logger.info(f"DATA QUALITY REPORT: {report['file']}")
    logger.info(f"{'='*60}")
    logger.info(f"Rows: {report['n_rows']}, Columns: {report['n_columns']}")
    logger.info(f"Overall: {'PASS' if report['passed'] else 'FAIL'}")
    logger.info(f"{'='*60}")

    for check_name, check_result in report["checks"].items():
        status = "✓" if check_result["passed"] else "✗"
        logger.info(f"  {status} {check_name}: {check_result['detail']}")

    if report.get("summary_stats"):
        logger.info(f"\nFeature Statistics:")
        for col, stats in report["summary_stats"].items():
            logger.info(f"  {col}: mean={stats['mean']:.2f}, std={stats['std']:.2f}, range=[{stats['min']:.2f}, {stats['max']:.2f}]")

    if args.output:
        import json
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        logger.info(f"\nReport saved to {output_path}")

    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
