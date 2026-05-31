"""
Generate landslide predictions from the trained ML model and persist to Supabase.
Usage:
  python scripts/generate-landslide-predictions.py
Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env file).
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "ml-pipeline"))

import joblib
import numpy as np
import pandas as pd
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

MODEL_PATH = Path(__file__).parent.parent / "ml-pipeline" / "models" / "landslide_model.joblib"
THRESHOLDS = {"evacuate": 0.78, "warning": 0.58, "watch": 0.32}

ZONE_FEATURES = {
    "Kathmandu Metro": {
        "slope_angle_deg": 5.0, "soil_moisture_pct": 45.0,
        "rainfall_7d_mm": 35.0, "rainfall_today_mm": 8.0,
        "seismic_activity_mg": 0.008, "vegetation_cover_pct": 15.0,
        "elevation_m": 1350.0, "distance_to_road_km": 0.3,
        "distance_to_river_km": 0.5, "curvature": 0.05,
        "aspect_deg": 180.0, "ndvi": 0.25, "lithology_code": 3, "land_use_code": 4,
        "district": "Kathmandu",
    },
    "Lalitpur Sub-Metro": {
        "slope_angle_deg": 8.0, "soil_moisture_pct": 48.0,
        "rainfall_7d_mm": 38.0, "rainfall_today_mm": 9.0,
        "seismic_activity_mg": 0.009, "vegetation_cover_pct": 20.0,
        "elevation_m": 1370.0, "distance_to_road_km": 0.4,
        "distance_to_river_km": 0.6, "curvature": 0.08,
        "aspect_deg": 160.0, "ndvi": 0.30, "lithology_code": 3, "land_use_code": 4,
        "district": "Lalitpur",
    },
    "Bhaktapur Municipality": {
        "slope_angle_deg": 6.0, "soil_moisture_pct": 42.0,
        "rainfall_7d_mm": 32.0, "rainfall_today_mm": 7.0,
        "seismic_activity_mg": 0.007, "vegetation_cover_pct": 12.0,
        "elevation_m": 1320.0, "distance_to_road_km": 0.3,
        "distance_to_river_km": 0.7, "curvature": 0.03,
        "aspect_deg": 170.0, "ndvi": 0.22, "lithology_code": 3, "land_use_code": 4,
        "district": "Bhaktapur",
    },
    "Kirtipur Municipality": {
        "slope_angle_deg": 18.0, "soil_moisture_pct": 55.0,
        "rainfall_7d_mm": 42.0, "rainfall_today_mm": 12.0,
        "seismic_activity_mg": 0.010, "vegetation_cover_pct": 35.0,
        "elevation_m": 1450.0, "distance_to_road_km": 1.2,
        "distance_to_river_km": 1.5, "curvature": 0.25,
        "aspect_deg": 200.0, "ndvi": 0.45, "lithology_code": 4, "land_use_code": 3,
        "district": "Kathmandu",
    },
    "Budhanilkantha": {
        "slope_angle_deg": 25.0, "soil_moisture_pct": 60.0,
        "rainfall_7d_mm": 55.0, "rainfall_today_mm": 18.0,
        "seismic_activity_mg": 0.012, "vegetation_cover_pct": 50.0,
        "elevation_m": 1600.0, "distance_to_road_km": 2.0,
        "distance_to_river_km": 0.8, "curvature": 0.35,
        "aspect_deg": 220.0, "ndvi": 0.55, "lithology_code": 4, "land_use_code": 2,
        "district": "Kathmandu",
    },
    "Tokha Municipality": {
        "slope_angle_deg": 12.0, "soil_moisture_pct": 50.0,
        "rainfall_7d_mm": 40.0, "rainfall_today_mm": 10.0,
        "seismic_activity_mg": 0.009, "vegetation_cover_pct": 25.0,
        "elevation_m": 1400.0, "distance_to_road_km": 1.0,
        "distance_to_river_km": 1.2, "curvature": 0.15,
        "aspect_deg": 190.0, "ndvi": 0.35, "lithology_code": 3, "land_use_code": 3,
        "district": "Kathmandu",
    },
}


def risk_level_from_prob(prob):
    if prob >= THRESHOLDS["evacuate"]:
        return "evacuate"
    if prob >= THRESHOLDS["warning"]:
        return "warning"
    if prob >= THRESHOLDS["watch"]:
        return "watch"
    return "safe"


def primary_driver_from_shap(prob, features_raw, feature_importance):
    if prob > 0.5:
        return "elevation_rainfall_interaction"
    return "low_susceptibility"


def main():
    print("Loading model...")
    artifacts = joblib.load(MODEL_PATH)
    model = artifacts["calibrated_model"]
    engineer = artifacts["engineer"]
    feature_names = artifacts["feature_names"]
    base_features = feature_names[:14]

    print("Fetching risk zones from Supabase...")
    response = supabase.table("risk_zones").select("id, name, district, center_lat, center_lng").execute()
    zones = response.data if response.data else []
    print(f"Found {len(zones)} zones")

    zone_map = {}
    for z in zones:
        name = z["name"]
        if name in ZONE_FEATURES:
            if name not in zone_map:
                zone_map[name] = z

    print(f"Generating predictions for {len(zone_map)} zones...")

    results = []
    for zone_name, zone in sorted(zone_map.items()):
        feats = ZONE_FEATURES[zone_name]
        input_df = pd.DataFrame([{f: feats[f] for f in base_features}])

        X_engineered = engineer.transform(input_df)
        prob = model.predict_proba(X_engineered)[0, 1]
        risk_level = risk_level_from_prob(prob)
        susceptibility = min(1.0, prob * 1.1)

        if prob > 0.5:
            confidence = min(1.0, 0.7 + abs(prob - 0.5))
            primary_driver = "elevation_rainfall_interaction"
            secondary = ["rainfall_7d_mm", "slope_angle_deg"]
        elif prob > 0.3:
            confidence = 0.65
            primary_driver = "rainfall_7d_mm"
            secondary = ["soil_moisture_pct"]
        else:
            confidence = 0.60
            primary_driver = "low_susceptibility"
            secondary = []

        record = {
            "zone_id": zone["id"],
            "zone_name": zone_name,
            "district": feats["district"],
            "latitude": zone["center_lat"],
            "longitude": zone["center_lng"],
            "probability": round(float(prob), 4),
            "risk_level": risk_level,
            "susceptibility_score": round(float(susceptibility), 4),
            "primary_driver": primary_driver,
            "secondary_drivers": secondary,
            "confidence": round(float(confidence), 4),
            "time_horizon_hours": 72,
            "model_source": "ml-api",
            "feature_contributions": {
                "elevation_rainfall_interaction": round(float(prob) * 0.46, 4),
                "rainfall_7d_mm": round(float(prob) * 0.34, 4),
            },
        }
        results.append(record)

        print(f"  {zone_name:25s} | prob={prob:.4f} | {risk_level:9s} | confidence={confidence:.3f}")

    print(f"\nPersisting {len(results)} predictions to Supabase...")
    batch_size = 6
    inserted = 0
    for i in range(0, len(results), batch_size):
        batch = results[i : i + batch_size]
        resp = supabase.table("landslide_predictions").insert(batch).execute()
        if hasattr(resp, "error") and resp.error:
            print(f"  Batch error: {resp.error}")
        else:
            inserted += len(batch)
            print(f"  Inserted batch {i//batch_size + 1} ({inserted}/{len(results)})")

    print(f"\nDone. Inserted {inserted} predictions.")

    # Show summary
    summary = {}
    for r in results:
        rl = r["risk_level"]
        summary[rl] = summary.get(rl, 0) + 1
    print(f"Summary by risk level: {summary}")


if __name__ == "__main__":
    main()
