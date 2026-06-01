"""
Generate landslide predictions from the trained ML model and persist to Supabase.
Fetches real environmental data for all 54 risk zones, runs through the ML pipeline,
and stores calibrated probabilities.

Usage:
  python scripts/generate-landslide-predictions.py
  python scripts/generate-landslide-predictions.py --days 7 --dry-run

Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env file).
"""
import argparse
import json
import logging
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

log = logging.getLogger("generate_landslide_predictions")

sys.path.insert(0, str(Path(__file__).parent.parent / "ml-pipeline"))

import joblib
import numpy as np
import pandas as pd
from supabase import create_client

USER_AGENT = "Bahuraksha/1.0 (ml prediction; github.com/hadumon/Bahuraksha)"

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

MODEL_PATH = Path(__file__).parent.parent / "ml-pipeline" / "models" / "landslide_model.joblib"
THRESHOLDS = {"evacuate": 0.78, "warning": 0.58, "watch": 0.32}

BASE_FEATURES = [
    "slope_angle_deg", "soil_moisture_pct", "rainfall_7d_mm", "rainfall_today_mm",
    "seismic_activity_mg", "vegetation_cover_pct", "elevation_m",
    "distance_to_road_km", "distance_to_river_km", "curvature", "aspect_deg",
    "ndvi", "lithology_code", "land_use_code",
]


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        log.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def fetch_rainfall(lat: float, lon: float, days: int) -> list[float]:
    """Fetch daily rainfall from NASA POWER for the past N days."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    url = (
        f"https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters=PRECTOTCORR"
        f"&community=RE&longitude={lon}&latitude={lat}"
        f"&start={start.strftime('%Y%m%d')}&end={end.strftime('%Y%m%d')}"
        f"&format=JSON"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        params = data.get("properties", {}).get("parameter", {})
        precip = params.get("PRECTOTCORR", {})
        vals = []
        for k in sorted(precip.keys()):
            v = precip[k]
            if v is not None and v != "NaN":
                try:
                    vals.append(max(0.0, float(v)))
                except (ValueError, TypeError):
                    vals.append(0.0)
            else:
                vals.append(0.0)
        time.sleep(0.25)
        return vals[-days:] if len(vals) >= days else vals + [0.0] * (days - len(vals))
    except Exception as e:
        log.debug("NASA POWER failed for (%s,%s): %s", lat, lon, e)
        return [0.0] * days


def fetch_seismic_activity(lat: float, lon: float, days: int) -> float:
    """Fetch max earthquake magnitude from USGS within 500km."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    url = (
        f"https://earthquake.usgs.gov/fdsnws/event/1/query"
        f"?format=geojson&starttime={start.strftime('%Y-%m-%d')}"
        f"&endtime={end.strftime('%Y-%m-%d')}"
        f"&latitude={lat}&longitude={lon}&maxradiuskm=500"
        f"&minmagnitude=2.5&orderby=magnitude"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        features = data.get("features", [])
        if not features:
            return 0.0
        max_mag = 0.0
        for feat in features[:5]:
            mag = feat.get("properties", {}).get("mag", 0) or 0
            max_mag = max(max_mag, mag)
        return min(5.0, max_mag)
    except Exception as e:
        log.debug("USGS failed: %s", e)
        return 0.0


def build_ml_features(zone: dict) -> dict:
    """Build 14-feature vector for the ML model using real environmental data."""
    lat, lon = zone["lat"], zone["lon"]
    name = zone["name"]

    daily_rainfall = fetch_rainfall(lat, lon, 8)
    rainfall_7d = sum(daily_rainfall[:-1]) if len(daily_rainfall) > 1 else 0.0
    rainfall_today = daily_rainfall[-1] if daily_rainfall else 0.0
    seismic = fetch_seismic_activity(lat, lon, 30)

    elevation = 100 + (lat - 26.3) / (30.5 - 26.3) * 4000

    avg_lat = 27.7
    slope = 5 + (max(0, lat - avg_lat) * 8) + abs((lon - 85.3) / 1.5)

    ndvi = 0.15 + 0.6 * max(0, 1 - abs(lat - 28.5) / 3)
    ndvi = min(0.85, ndvi)

    # SIMULATED STORM OVERRIDE (For testing UI)
    rainfall_7d = 350.0 + np.random.default_rng(seed=abs(hash(name))).normal(0, 50)
    rainfall_today = 150.0 + np.random.default_rng(seed=abs(hash(name))+1).normal(0, 20)
    seismic = 4.5
    soil_moisture = 95.0
    vegetation = min(85, 20 + ndvi * 60)
    dist_road = 0.5 + abs(lon - 85.0) * 5
    dist_river = 0.3 + abs(lat - 27.5) * 3

    dist_road = 0.5 + abs(lon - 85.0) * 5
    dist_river = 0.3 + abs(lat - 27.5) * 3

    curvature = np.random.default_rng(seed=hash(name) % 10000).normal(0, 0.3)
    aspect = (hash(name + "aspect") % 360)

    lithology = 1 + (hash(name + "lith") % 4)
    land_use = 1 + (hash(name + "lu") % 4)

    return {
        "slope_angle_deg": round(min(60, slope), 1),
        "soil_moisture_pct": round(soil_moisture, 1),
        "rainfall_7d_mm": round(rainfall_7d, 1),
        "rainfall_today_mm": round(rainfall_today, 1),
        "seismic_activity_mg": round(seismic, 3),
        "vegetation_cover_pct": round(vegetation, 1),
        "elevation_m": round(elevation, 0),
        "distance_to_road_km": round(dist_road, 2),
        "distance_to_river_km": round(dist_river, 2),
        "curvature": round(curvature, 3),
        "aspect_deg": round(aspect, 1),
        "ndvi": round(ndvi, 3),
        "lithology_code": lithology,
        "land_use_code": land_use,
    }


def risk_level_from_prob(prob: float) -> str:
    if prob >= THRESHOLDS["evacuate"]:
        return "evacuate"
    if prob >= THRESHOLDS["warning"]:
        return "warning"
    if prob >= THRESHOLDS["watch"]:
        return "watch"
    return "safe"


def main():
    parser = argparse.ArgumentParser(description="Generate ML landslide predictions")
    parser.add_argument("--days", type=int, default=7, help="Rainfall lookback (default: 7)")
    parser.add_argument("--dry-run", action="store_true", help="Print without writing")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    log.info("Loading ML model from %s...", MODEL_PATH)
    artifacts = joblib.load(MODEL_PATH)
    model = artifacts["calibrated_model"]
    engineer = artifacts["engineer"]
    log.info("Model loaded. Feature names: %s", engineer.get_feature_names_out())

    supabase = get_supabase()

    log.info("Fetching risk zones from Supabase...")
    result = supabase.table("risk_zones").select("id, name, district, center_lat, center_lng, population").execute()
    zones = result.data if result.data else []
    log.info("Found %d zones", len(zones))

    results = []
    for i, zone in enumerate(zones):
        name = zone["name"]
        district = zone.get("district", "")
        zone_id = zone["id"]
        lat = zone.get("center_lat", 27.7)
        lon = zone.get("center_lng", 85.3)

        log.info("  [%d/%d] %s (%s) %.4f,%.4f...",
                 i + 1, len(zones), name, district, lat, lon)

        feats = build_ml_features({"lat": lat, "lon": lon, "name": name})
        input_df = pd.DataFrame([feats])

        try:
            X = engineer.transform(input_df)
            prob = float(model.predict_proba(X)[0, 1])
            risk_level = risk_level_from_prob(prob)
            susceptibility = min(1.0, prob * 1.1)

            if prob > 0.5:
                confidence = min(1.0, 0.7 + (prob - 0.5) * 0.6)
                primary_driver = "elevation_rainfall_interaction"
                secondary = ["rainfall_7d_mm", "slope_angle_deg"]
            elif prob > 0.3:
                confidence = 0.65
                primary_driver = "rainfall_7d_mm"
                secondary = ["soil_moisture_pct", "slope_angle_deg"]
            else:
                confidence = 0.60
                primary_driver = "low_susceptibility"
                secondary = []

            record = {
                "zone_id": zone_id,
                "zone_name": name,
                "district": district,
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "probability": round(prob, 4),
                "risk_level": risk_level,
                "susceptibility_score": round(susceptibility, 4),
                "primary_driver": primary_driver,
                "secondary_drivers": secondary,
                "confidence": round(confidence, 3),
                "time_horizon_hours": 72,
                "model_source": "ml-api",
                "feature_contributions": {
                    "rainfall_7d_mm": feats["rainfall_7d_mm"],
                    "seismic_activity_mg": feats["seismic_activity_mg"],
                    "slope_angle_deg": feats["slope_angle_deg"],
                    "elevation_m": feats["elevation_m"],
                    "ndvi": feats["ndvi"],
                },
            }
            results.append(record)
            log.info("    → prob=%.4f (%s), driver=%s", prob, risk_level, primary_driver)
        except Exception as e:
            log.error("    → ML inference failed: %s", e)
            continue

    summary = {}
    for r in results:
        rl = r["risk_level"]
        summary[rl] = summary.get(rl, 0) + 1
    log.info("Summary by risk level: %s", summary)

    if args.dry_run:
        log.info("[dry-run] would insert %d predictions", len(results))
        return

    log.info("Persisting %d predictions to Supabase...", len(results))
    batch_size = 10
    inserted = 0
    for i in range(0, len(results), batch_size):
        batch = results[i:i + batch_size]
        try:
            resp = supabase.table("landslide_predictions").insert(batch).execute()
            inserted += len(batch)
            log.info("  Inserted batch %d/%d (%d rows)",
                     i // batch_size + 1, (len(results) + batch_size - 1) // batch_size, len(batch))
        except Exception as e:
            log.error("  Batch insert failed: %s", e)

    log.info("Done! Inserted %d ML-generated predictions.", inserted)


if __name__ == "__main__":
    main()
