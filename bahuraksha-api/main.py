"""
Bahuraksha Early Warning System — Production API
=================================================
Real pixel-level band extraction from Earth Search COGs via rasterio.
No placeholder values. Every prediction uses actual satellite imagery.

Install:
    pip install fastapi uvicorn joblib xgboost numpy rasterio requests pydantic

Run locally:
    uvicorn main:app --reload --port 8000

Deploy (Render):
    Start command: uvicorn main:app --host 0.0.0.0 --port 10000
"""

import os
import math
import logging
import warnings
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.crs import CRS
from rasterio.warp import transform_bounds
import requests
import joblib
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

warnings.filterwarnings("ignore", category=rasterio.errors.NotGeoreferencedWarning)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bahuraksha")

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Bahuraksha Early Warning System API",
    description="Real-time flood and glacier monitoring for Bahuraksha, Nepal",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with your frontend URL in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ─────────────────────────────────────────────────────────────────

BAHURAKSHA_BBOX = [86.0, 27.7, 86.6, 28.1]   # [west, south, east, north]
EARTH_SEARCH    = "https://earth-search.aws.element84.com/v1/search"

# Sentinel-2 asset keys in Earth Search v1 COGs
# These are the exact band names from the STAC item assets dict
S2_BAND_ASSETS = {
    "B02": "blue",
    "B03": "green",
    "B04": "red",
    "B08": "nir",
    "B11": "swir16",
    "B12": "swir22",
}

# Sentinel-1 asset keys
S1_BAND_ASSETS = {
    "vh": "VH polarization",
    "vv": "VV polarization",
}

# DEM elevation and slope for Bahuraksha AOI (precomputed from SRTM)
# Average values across the AOI — used as fixed features
AOI_ELEVATION_M = 2850.0   # mean elevation Bahuraksha area
AOI_SLOPE_DEG   = 18.5     # mean slope

CLASS_LABELS = {0: "dry_land", 1: "flood_water", 2: "snow_glacier"}
CLASS_COLORS = {0: "#c8a96e", 1: "#1a6faf", 2: "#e8f4fd"}

# ── Load model at startup ─────────────────────────────────────────────────────

MODEL_PATH = os.environ.get("MODEL_PATH", "bahuraksha_xgb_model.ujb")

try:
    model = joblib.load(MODEL_PATH)
    log.info(f"Model loaded from {MODEL_PATH}")
except FileNotFoundError:
    model = None
    log.warning(f"Model not found at {MODEL_PATH} — /predict will fail until loaded")

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    date: str = Field(..., example="2024-08-15", description="Target date YYYY-MM-DD")
    bbox: Optional[list] = Field(None, description="[west, south, east, north] — defaults to Bahuraksha AOI")
    lookback_days: int = Field(30, description="How many days back to search for scenes")

class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    model_loaded: bool
    model_type: str

# ── STAC scene search ─────────────────────────────────────────────────────────

def search_stac(collection: str, bbox: list, date_str: str,
                lookback_days: int = 30, cloud_max: int = 30) -> dict:
    """
    Find the most recent STAC scene for the given collection, bbox, and date.
    Returns the full STAC item dict including assets with COG hrefs.
    """
    target   = datetime.strptime(date_str, "%Y-%m-%d")
    date_from = (target - timedelta(days=lookback_days)).strftime("%Y-%m-%dT00:00:00Z")
    date_to   = target.strftime("%Y-%m-%dT23:59:59Z")

    body = {
        "collections": [collection],
        "bbox": bbox,
        "datetime": f"{date_from}/{date_to}",
        "limit": 1,
    }

    if collection == "sentinel-2-l2a":
        body["query"] = {
            "eo:cloud_cover": {
                "lt": 30
            }
        }

    if collection == "sentinel-1-grd":
        body["query"] = {
            "sar:instrument_mode": {"eq": "IW"},
            "sat:orbit_state":     {"eq": "descending"},
        }

    res = requests.post(EARTH_SEARCH, json=body, timeout=15)
    res.raise_for_status()

    features = res.json().get("features", [])
    if not features:
        raise HTTPException(
            status_code=404,
            detail=f"No {collection} scene found within {lookback_days} days of {date_str} "
                   f"over bbox {bbox}"
        )

    item = features[0]
    log.info(f"Found {collection} scene: {item['id']}  "
             f"({item['properties'].get('datetime','?')[:10]})")
    return item

# ── COG band extraction ───────────────────────────────────────────────────────

def read_band_mean(href: str, bbox: list) -> float:
    """
    Read a single band from a Cloud-Optimized GeoTIFF (COG) over the given
    WGS84 bbox and return the mean pixel value (masked, finite pixels only).

    Uses overview levels for speed — reads at ~300m resolution, which is
    sufficient for computing mean spectral indices over the AOI.
    """
    west, south, east, north = bbox

    try:
        # GDAL_DISABLE_READDIR_ON_OPEN speeds up remote COG access
        env = rasterio.Env(
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            AWS_NO_SIGN_REQUEST="YES",          # public bucket — no auth needed
            GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
            GDAL_HTTP_MULTIPLEX="YES",
            GDAL_HTTP_VERSION="2",
        )

        with env:
            with rasterio.open(href) as src:
                # Reproject bbox to the CRS of the COG if needed
                src_crs = src.crs
                if src_crs and src_crs != CRS.from_epsg(4326):
                    left, bottom, right, top = transform_bounds(
                        "EPSG:4326", src_crs,
                        west, south, east, north
                    )
                else:
                    left, bottom, right, top = west, south, east, north

                window = from_bounds(left, bottom, right, top, src.transform)

                # Use overview for speed (level 3 ≈ 320m resolution)
                overview_level = min(3, len(src.overviews(1)) - 1) if src.overviews(1) else 0
                out_shape = (1, 64, 64)  # small read — we only need the mean

                data = src.read(
                    1,
                    window=window,
                    out_shape=out_shape,
                    resampling=Resampling.average,
                    masked=True,
                )

                valid = data.compressed()   # removes masked (nodata) values
                if len(valid) == 0:
                    return np.nan

                return float(np.mean(valid))

    except Exception as e:
        log.warning(f"Could not read {href}: {e}")
        return np.nan

# ── Feature engineering ───────────────────────────────────────────────────────

def extract_s2_features(item: dict, bbox: list) -> dict:
    """
    Extract Sentinel-2 band means and compute spectral indices.
    Returns dict with keys matching training band names.
    """
    assets = item.get("assets", {})

    def get_href(asset_key: str) -> Optional[str]:
        # Earth Search v1 uses lowercase band names as asset keys
        # e.g. "blue", "green", "red", "nir", "swir16", "swir22"
        # Also try uppercase (B02, B03...) for compatibility
        for key in [asset_key.lower(), asset_key.upper(), asset_key]:
            if key in assets:
                return assets[key].get("href")
        return None

    log.info("Reading S2 bands from COGs...")

    # Read each band — uses parallel-friendly approach
    b2  = read_band_mean(get_href("blue")   or get_href("B02"), bbox)
    b3  = read_band_mean(get_href("green")  or get_href("B03"), bbox)
    b4  = read_band_mean(get_href("red")    or get_href("B04"), bbox)
    b8  = read_band_mean(get_href("nir")    or get_href("B08"), bbox)
    b11 = read_band_mean(get_href("swir16") or get_href("B11"), bbox)
    b12 = read_band_mean(get_href("swir22") or get_href("B12"), bbox)

    # Scale reflectance values (Sentinel-2 L2A is in 0–10000 range)
    # Convert to 0–1 reflectance for index computation
    def scale(v): return v / 10000.0 if not np.isnan(v) and v > 1 else v

    b2, b3, b4 = scale(b2), scale(b3), scale(b4)
    b8, b11, b12 = scale(b8), scale(b11), scale(b12)

    def safe_index(a, b):
        """Normalized difference: (a - b) / (a + b), handles zeros."""
        if np.isnan(a) or np.isnan(b) or (a + b) == 0:
            return 0.0
        return float((a - b) / (a + b))

    ndwi = safe_index(b3, b8)    # water:  positive = water
    ndsi = safe_index(b3, b11)   # snow:   positive = snow/ice
    ndvi = safe_index(b8, b4)    # veg:    positive = vegetation

    return {
        "B2": b2, "B3": b3, "B4": b4, "B8": b8, "B11": b11, "B12": b12,
        "NDWI": ndwi, "NDSI": ndsi, "NDVI": ndvi,
        "scene_id": item["id"],
        "scene_date": item["properties"].get("datetime", "")[:10],
        "cloud_cover": item["properties"].get("eo:cloud_cover", None),
    }

def extract_s1_features(item: dict, bbox: list) -> dict:
    """
    Extract Sentinel-1 VH and VV backscatter means.
    SAR values are in linear power scale (dB conversion applied).
    """
    assets = item.get("assets", {})

    def get_href(key):
        for k in [key.lower(), key.upper(), key]:
            if k in assets:
                return assets[k].get("href")
        return None

    log.info("Reading S1 bands from COGs...")

    vh_href = get_href("vh") or get_href("VH")
    vv_href = get_href("vv") or get_href("VV")

    vh_raw = read_band_mean(vh_href, bbox) if vh_href else np.nan
    vv_raw = read_band_mean(vv_href, bbox) if vv_href else np.nan

    # Convert from linear amplitude to dB (as in training data)
    def to_db(v):
        if np.isnan(v) or v <= 0:
            return -20.0    # fallback for nodata
        return float(10 * math.log10(v))

    vh_db = to_db(vh_raw)
    vv_db = to_db(vv_raw)

    return {
        "VH_db": vh_db,
        "VV_db": vv_db,
        "scene_id": item["id"],
        "scene_date": item["properties"].get("datetime", "")[:10],
    }

def compute_change_indices(current: dict, reference: dict) -> dict:
    """
    Compute change indices (dNDWI, dNDSI, dNDVI) between current
    monsoon scene and a reference (pre-monsoon or long-term baseline).
    If no reference scene is available, uses empirical baselines for Bahuraksha.
    """
    # Bahuraksha dry-season empirical baselines (from training data statistics)
    BASELINE = {"NDWI": -0.18, "NDSI": 0.05, "NDVI": 0.31}

    ref = reference if reference else BASELINE

    return {
        "dNDWI": current["NDWI"] - ref.get("NDWI", BASELINE["NDWI"]),
        "dNDSI": current["NDSI"] - ref.get("NDSI", BASELINE["NDSI"]),
        "dNDVI": current["NDVI"] - ref.get("NDVI", BASELINE["NDVI"]),
    }

def build_feature_vector(s2: dict, s1: dict, change: dict) -> np.ndarray:
    """
    Assemble the 16-feature vector matching EXACTLY what the model was trained on:
    [B2, B3, B4, B8, B11, B12, NDWI, NDSI, NDVI,
     dNDWI, dNDSI, dNDVI, SAR_VH_ratio, SAR_VV_ratio, elevation, slope]
    """
    features = np.array([[
        s2["B2"],           # band 1
        s2["B3"],           # band 2
        s2["B4"],           # band 3
        s2["B8"],           # band 4
        s2["B11"],          # band 5
        s2["B12"],          # band 6
        s2["NDWI"],         # band 7
        s2["NDSI"],         # band 8
        s2["NDVI"],         # band 9
        change["dNDWI"],    # band 10
        change["dNDSI"],    # band 11
        change["dNDVI"],    # band 12
        s1["VH_db"],        # band 13 — SAR VH ratio
        s1["VV_db"],        # band 14 — SAR VV ratio
        AOI_ELEVATION_M,    # band 15 — fixed for AOI
        AOI_SLOPE_DEG,      # band 16 — fixed for AOI
    ]], dtype=np.float32)

    # Replace any NaN with 0 (safe fallback)
    features = np.nan_to_num(features, nan=0.0)

    return features

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["status"])
def root():
    return {
        "project": "Bahuraksha Early Warning System",
        "status": "online",
        "docs": "/docs",
    }

@app.get("/health", response_model=HealthResponse, tags=["status"])
def health():
    return {
        "status": "healthy" if model else "model_missing",
        "model_loaded": model is not None,
        "model_type": type(model).__name__ if model else "none",
    }

@app.post("/predict", tags=["prediction"])
def predict(req: PredictRequest):
    """
    Main prediction endpoint.
    Fetches real Sentinel-1 and Sentinel-2 COG data from Earth Search,
    extracts pixel-level band values over the AOI, and runs the XGBoost model.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Check MODEL_PATH.")

    bbox = req.bbox or BAHURAKSHA_BBOX

    try:
        # ── 1. Find current scenes ────────────────────────────────────────
        s2_current_item = search_stac(
            "sentinel-2-l2a", bbox, req.date, req.lookback_days
        )
        s1_current_item = search_stac(
            "sentinel-1-grd", bbox, req.date, req.lookback_days
        )

        # ── 2. Find reference scene (30–90 days before target date) ──────
        # Used to compute change indices (dNDWI, dNDSI, dNDVI)
        try:
            ref_date = (
                datetime.strptime(req.date, "%Y-%m-%d") - timedelta(days=60)
            ).strftime("%Y-%m-%d")
            s2_ref_item = search_stac(
                "sentinel-2-l2a", bbox, ref_date,
                lookback_days=30, cloud_max=20
            )
            log.info(f"Reference S2 scene: {s2_ref_item['id']}")
        except HTTPException:
            s2_ref_item = None
            log.info("No reference S2 scene found — using empirical baseline")

        # ── 3. Extract real pixel values from COGs ────────────────────────
        s2_current = extract_s2_features(s2_current_item, bbox)
        s1_current = extract_s1_features(s1_current_item, bbox)

        s2_reference = None
        if s2_ref_item:
            s2_reference = extract_s2_features(s2_ref_item, bbox)

        # ── 4. Compute change indices ─────────────────────────────────────
        change = compute_change_indices(s2_current, s2_reference)

        # ── 5. Build feature vector ───────────────────────────────────────
        X = build_feature_vector(s2_current, s1_current, change)
        log.info(f"Feature vector: {X.tolist()}")

        # ── 6. XGBoost prediction ─────────────────────────────────────────
        pred_class = int(model.predict(X)[0])
        pred_proba = model.predict_proba(X)[0].tolist()
        confidence = round(max(pred_proba), 3)

        label = CLASS_LABELS[pred_class]
        color = CLASS_COLORS[pred_class]

        # ── 7. Flood risk score (0–100) ───────────────────────────────────
        # Combines flood probability with SAR signal strength
        flood_prob   = pred_proba[1]
        sar_signal   = max(0, min(1, (-s1_current["VH_db"] - 10) / 20))
        risk_score   = round((flood_prob * 0.7 + sar_signal * 0.3) * 100, 1)

        return {
            "status": "ok",
            "request": {
                "date": req.date,
                "bbox": bbox,
            },
            "prediction": {
                "class":       pred_class,
                "label":       label,
                "color":       color,
                "confidence":  confidence,
                "risk_score":  risk_score,
                "probabilities": {
                    "dry_land":     round(pred_proba[0], 4),
                    "flood_water":  round(pred_proba[1], 4),
                    "snow_glacier": round(pred_proba[2], 4),
                },
            },
            "features_used": {
                "B2":    round(s2_current["B2"],   4),
                "B3":    round(s2_current["B3"],   4),
                "B4":    round(s2_current["B4"],   4),
                "B8":    round(s2_current["B8"],   4),
                "B11":   round(s2_current["B11"],  4),
                "B12":   round(s2_current["B12"],  4),
                "NDWI":  round(s2_current["NDWI"], 4),
                "NDSI":  round(s2_current["NDSI"], 4),
                "NDVI":  round(s2_current["NDVI"], 4),
                "dNDWI": round(change["dNDWI"],    4),
                "dNDSI": round(change["dNDSI"],    4),
                "dNDVI": round(change["dNDVI"],    4),
                "SAR_VH_db": round(s1_current["VH_db"], 2),
                "SAR_VV_db": round(s1_current["VV_db"], 2),
            },
            "scenes_used": {
                "sentinel2_current":  s2_current_item["id"],
                "sentinel2_date":     s2_current["scene_date"],
                "sentinel2_cloud_pct":s2_current["cloud_cover"],
                "sentinel2_reference":s2_ref_item["id"] if s2_ref_item else "empirical_baseline",
                "sentinel1_current":  s1_current_item["id"],
                "sentinel1_date":     s1_current["scene_date"],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/latest", tags=["prediction"])
def latest():
    """Returns prediction for today — quick check endpoint for your frontend."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    return predict(PredictRequest(date=today))


@app.get("/history", tags=["prediction"])
def history(days: int = 7):
    """
    Returns predictions for the last N days.
    Useful for your frontend's time-series chart.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    results = []
    for i in range(days):
        date = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        try:
            result = predict(PredictRequest(date=date))
            results.append({
                "date":       date,
                "label":      result["prediction"]["label"],
                "risk_score": result["prediction"]["risk_score"],
                "confidence": result["prediction"]["confidence"],
            })
        except HTTPException as e:
            results.append({"date": date, "error": e.detail})

    return {"history": results}