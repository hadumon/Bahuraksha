"""
Generate plausible Bagmati basin CSV data files for backend API.

Usage:
    python seed_csv_data.py                          # generate all CSVs
    python seed_csv_data.py --dry-run                # print what would be created
    python seed_csv_data.py --days 90                # generate N days of data

Output:
    bahuraksha-api/data/raw/rainfall/gpm_bagmati_daily.csv
    bahuraksha-api/data/raw/discharge/glofas_bagmati_daily.csv
    bahuraksha-api/data/raw/sentinel/sentinel1_bagmati_daily.csv
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config

log = logging.getLogger("seed_csv_data")

# ─── Nepal monsoon parameters (Bagmati basin, Kathmandu Valley) ───────────────
# Monsoon: June–September (peak Jul–Aug). Dry: Nov–Feb. Transition: Mar–May, Oct.
# Typical values: monsoon ~10mm/day, dry ~1mm/day
MONTHLY_RAIN_BASE = {
    1: 15, 2: 20, 3: 35, 4: 55, 5: 120,
    6: 250, 7: 360, 8: 330, 9: 200,
    10: 65, 11: 10, 12: 5,
}

# Discharge parameters (cumecs, Bagmati at Chovar)
# Derived from typical values for a ~600km² basin at ~1500m elevation
BASE_DISCHARGE_CUMECS = 15.0
MONSOON_DISCHARGE_BOOST = 3.0
SOIL_MOISTURE_BASE = 0.30

# SAR parameters (C-band VV/VH backscatter for urban/agricultural Kathmandu Valley)
SAR_VV_BASE = -8.0
SAR_VH_BASE = -14.0
MONSOON_SAR_DAMPENING_DB = 2.0


def _generate_rainfall(start: datetime, days: int) -> pd.DataFrame:
    dates = [start + timedelta(days=i) for i in range(days)]
    rows = []
    for d in dates:
        base = MONTHLY_RAIN_BASE.get(d.month, 50)
        noise = np.random.gamma(2, base / 4)
        if 6 <= d.month <= 9:
            noise *= 1.5
        rain_mm = max(0, base / 30 + noise)
        rows.append({"date": d.strftime("%Y-%m-%d"), "rainfall_mm": round(rain_mm, 2)})
    return pd.DataFrame(rows)


def _generate_discharge(start: datetime, days: int, rainfall: pd.DataFrame) -> pd.DataFrame:
    dates = [start + timedelta(days=i) for i in range(days)]
    rain_lookup = dict(zip(rainfall["date"], rainfall["rainfall_mm"]))
    rows = []
    for d in dates:
        ds = d.strftime("%Y-%m-%d")
        rain_today = rain_lookup.get(ds, 0)
        monsoon_factor = 1.0 + MONSOON_DISCHARGE_BOOST * (1 if 6 <= d.month <= 9 else 0)
        discharge = BASE_DISCHARGE_CUMECS * monsoon_factor + rain_today * 0.8
        sm = SOIL_MOISTURE_BASE + rain_today / 1000
        rows.append({
            "date": ds,
            "discharge_cumecs": round(discharge + abs(np.random.normal(0, 2)), 2),
            "volumetric_soil_water_layer_1": round(min(1.0, sm + np.random.uniform(-0.02, 0.02)), 4),
            "volumetric_soil_water_layer_2": round(min(1.0, sm * 0.7 + np.random.uniform(-0.02, 0.02)), 4),
            "volumetric_soil_water_layer_3": round(min(1.0, sm * 0.5 + np.random.uniform(-0.02, 0.02)), 4),
            "volumetric_soil_water_layer_4": round(min(1.0, sm * 0.3 + np.random.uniform(-0.02, 0.02)), 4),
        })
    return pd.DataFrame(rows)


def _generate_sar(start: datetime, days: int) -> pd.DataFrame:
    dates = [start + timedelta(days=i) for i in range(days)]
    rows = []
    for d in dates:
        damp = MONSOON_SAR_DAMPENING_DB if 6 <= d.month <= 9 else 0
        vv = round(SAR_VV_BASE - damp + np.random.normal(0, 1), 2)
        vh = round(SAR_VH_BASE - damp + np.random.normal(0, 1), 2)
        rows.append({
            "date": d.strftime("%Y-%m-%d"),
            "sar_vv_db": vv,
            "sar_vh_db": vh,
            "sar_vv_vh_ratio_db": round(vv - vh, 2),
        })
    return pd.DataFrame(rows)


def main():
    parser = argparse.ArgumentParser(description="Seed Bagmati basin CSV data files")
    parser.add_argument("--dry-run", action="store_true", help="Print paths without writing")
    parser.add_argument("--days", type=int, default=365 * 3, help="Number of days of data (default: 3 years)")
    args = parser.parse_args()

    np.random.seed(42)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=args.days)

    log.info("Generating %d days of CSV data ending %s", args.days, end.strftime("%Y-%m-%d"))

    rainfall_df = _generate_rainfall(start, args.days)
    discharge_df = _generate_discharge(start, args.days, rainfall_df)
    sar_df = _generate_sar(start, args.days)

    targets = [
        (config.RAW_RAINFALL / "gpm_bagmati_daily.csv", rainfall_df),
        (config.RAW_DISCHARGE / "glofas_bagmati_daily.csv", discharge_df),
        (config.RAW_SENTINEL / "sentinel1_bagmati_daily.csv", sar_df),
    ]

    for path, df in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        if args.dry_run:
            log.info("[dry-run] would create %s (%d rows)", path, len(df))
        else:
            df.to_csv(path, index=False)
            log.info("Created %s (%d rows, %.1f KB)", path, len(df), path.stat().st_size / 1024)

    if not args.dry_run:
        log.info("All CSV data generated successfully.")
        for path, df in targets:
            log.info("  %s: %d rows, date range %s — %s",
                     path.name, len(df), df["date"].iloc[0], df["date"].iloc[-1])


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    main()
