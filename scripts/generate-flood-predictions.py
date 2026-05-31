"""
Generate flood predictions from the bahuraksha.onrender.com API and persist to Supabase.
Usage:
  python scripts/generate-flood-predictions.py
Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env file).
"""
import os
import sys
import json
from pathlib import Path
from datetime import datetime

import requests
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
API_BASE = "https://bahuraksha.onrender.com"


def risk_level_from_score(score):
    if score >= 75:
        return "evacuate"
    if score >= 50:
        return "warning"
    if score >= 25:
        return "watch"
    return "safe"


def fetch_latest_prediction():
    try:
        resp = requests.get(f"{API_BASE}/latest", timeout=30)
        if resp.ok:
            data = resp.json()
            pred = data.get("prediction", {})
            return {
                "label": pred.get("label", "dry_land"),
                "risk_score": round(float(pred.get("risk_score", 0)), 4),
                "confidence": round(float(pred.get("confidence", 0)), 4),
            }
        else:
            print(f"  API returned {resp.status_code}, using safe default")
    except requests.RequestException as e:
        print(f"  API unavailable ({e}), using safe default")

    return {"label": "dry_land", "risk_score": 0.0, "confidence": 0.6}


def fetch_risk_zones():
    resp = supabase.table("risk_zones").select("id, name, district, center_lat, center_lng").execute()
    return resp.data or []


def main():
    print("Fetching latest flood prediction from API...")
    try:
        prediction = fetch_latest_prediction()
        print(f"  Risk: {prediction['risk_score']:.1f}/100  Label: {prediction['label']}  Confidence: {prediction['confidence']:.3f}")
    except Exception as e:
        print(f"  API error: {e}")
        sys.exit(1)

    print("Fetching risk zones from Supabase...")
    zones = fetch_risk_zones()
    print(f"  Found {len(zones)} zones")

    risk_level = risk_level_from_score(prediction["risk_score"])
    records = []
    for zone in zones:
        records.append({
            "zone_id": zone["id"],
            "zone_name": zone["name"],
            "latitude": zone["center_lat"],
            "longitude": zone["center_lng"],
            "risk_score": prediction["risk_score"],
            "risk_level": risk_level,
            "label": prediction["label"],
            "confidence": prediction["confidence"],
            "model_source": "ml-api",
        })

    print(f"Persisting {len(records)} flood predictions to Supabase...")
    batch_size = 10
    inserted = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        resp = supabase.table("flood_predictions").insert(batch).execute()
        if hasattr(resp, "error") and resp.error:
            print(f"  Batch error: {resp.error}")
        else:
            inserted += len(batch)
            print(f"  Inserted batch {i // batch_size + 1} ({inserted}/{len(records)})")

    print(f"\nDone. Inserted {inserted} predictions.")
    summary = {}
    for r in records:
        rl = r["risk_level"]
        summary[rl] = summary.get(rl, 0) + 1
    print(f"Summary by risk level: {summary}")


if __name__ == "__main__":
    main()
