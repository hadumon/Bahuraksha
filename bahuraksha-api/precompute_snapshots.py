"""Pre-compute zone risk snapshots for offline demo fallback.

Usage: python precompute_snapshots.py

Output: bahuraksha-api/fallback_risk_snapshot.json
         Frontend can fetch this when the API is unavailable.
"""
import sys, json, math
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd

from csv_models import (
    BAGMATI_ZONES, _build_feature_row, _distance_m,
    load_daily_rainfall, load_daily_discharge, load_daily_sar, zone_static_features,
    _risk_level, WORLDCOVER_CLASSES, NDVI_PROXY,
)
from config import MODELS_DIR, STATIONS


def main():
    models_dir = Path(MODELS_DIR)

    import joblib
    flood_bundle = joblib.load(models_dir / "flood_model.pkl")
    landslide_bundle = joblib.load(models_dir / "landslide_model.pkl")

    rainfall = load_daily_rainfall()
    sar = load_daily_sar()
    zones_sf = zone_static_features()

    data_date = rainfall["date"].max()
    row = rainfall[rainfall["date"] == data_date].iloc[0]

    rf1 = float(row["rf_1day"])
    rf3 = float(row["rf_3day"])
    rf7 = float(row["rf_7day"])
    rf30 = float(row["rf_30day"])

    # Get latest SAR row
    sar_row = sar[sar["date"] <= data_date].iloc[-1] if len(sar) > 0 else None

    zones_out = []
    for zone in BAGMATI_ZONES:
        zid = str(zone["id"])
        sf = zones_sf.get(zid, {})
        lat, lon = float(zone["lat"]), float(zone["lon"])

        # Build flood features
        flood_payload = {
            "date": str(data_date.date()),
            "lat": lat, "lon": lon,
            "rf_1day": rf1, "rf_3day": rf3, "rf_7day": rf7, "rf_30day": rf30,
            "discharge_proxy": 1200.0, "soil_moisture_index": 0.55,
            "elevation_m": sf.get("elevation_m", 1200),
            "slope_deg": sf.get("slope_deg", 8),
            "aspect_deg": sf.get("aspect_deg", 120),
            "curvature": sf.get("curvature", 0),
        }
        if sar_row is not None:
            flood_payload["sar_vv_db"] = float(sar_row["sar_vv_db"])
            flood_payload["sar_vh_db"] = float(sar_row["sar_vh_db"])
            flood_payload["sar_vv_vh_ratio_db"] = float(sar_row["sar_vv_vh_ratio_db"])
        else:
            flood_payload["sar_vv_db"] = -14.0
            flood_payload["sar_vh_db"] = -20.0
            flood_payload["sar_vv_vh_ratio_db"] = 6.0

        ff = _build_feature_row(flood_payload, flood_bundle["feature_columns"])
        flood_prob = float(flood_bundle["model"].predict_proba(ff)[0, 1])

        # Build landslide features
        ls_payload = {
            "date": str(data_date.date()),
            "lat": lat, "lon": lon,
            "rf_1day": rf1, "rf_3day": rf3, "rf_7day": rf7, "rf_30day": rf30,
            "elevation_m": sf.get("elevation_m", 1200),
            "slope_deg": sf.get("slope_deg", 8),
            "aspect_deg": sf.get("aspect_deg", 120),
            "curvature": sf.get("curvature", 0),
            "landuse_code": int(round(sf.get("landuse_code", 50))),
            "ndvi_proxy": sf.get("ndvi_proxy", 0.10),
            "dist_drainage_m": sf.get("dist_drainage_m", 1000),
        }
        lf = _build_feature_row(ls_payload, landslide_bundle["feature_columns"])
        landslide_prob = float(landslide_bundle["model"].predict_proba(lf)[0, 1])

        rainfall_score = min(1.0, rf3 / 300.0)
        composite = max(flood_prob, landslide_prob, rainfall_score * 0.5)

        zones_out.append({
            "zone_id": zid,
            "zone_name": zone["name"],
            "district": zone["district"],
            "lat": lat, "lon": lon,
            "population": zone["population"],
            "flood_probability": round(flood_prob, 4),
            "landslide_probability": round(landslide_prob, 4),
            "rainfall_score": round(rainfall_score, 4),
            "composite_score": round(composite, 4),
            "risk_level": _risk_level(composite),
            "flood_predicted_event": 1 if flood_prob >= float(flood_bundle["threshold"]) else 0,
            "landslide_predicted_event": 1 if landslide_prob >= float(landslide_bundle["threshold"]) else 0,
            "data_quality": "historical_csv",
        })

    snapshot = {
        "requested_date": str(data_date.date()),
        "data_date": str(data_date.date()),
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "precomputed_snapshot",
        "formula": "composite = max(flood, landslide, rainfall * 0.5)",
        "model_versions": {
            "flood": f"xgboost:flood_model.pkl:precomputed",
            "landslide": f"xgboost:landslide_model.pkl:precomputed",
        },
        "zones": zones_out,
    }

    out_path = Path(__file__).parent / "fallback_risk_snapshot.json"
    with open(out_path, "w") as f:
        json.dump(snapshot, f, indent=2)

    print(f"Saved fallback snapshot for {len(zones_out)} zones to {out_path}")
    print(f"Data date: {data_date.date()}")
    for z in zones_out:
        print(f"  {z['zone_name']:25s} flood={z['flood_probability']:.3f}  ls={z['landslide_probability']:.3f}  risk={z['risk_level']}")


if __name__ == "__main__":
    main()
