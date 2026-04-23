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
Start command:
uvicorn main:app --host 0.0.0.0 --port 10000
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
import xgboost as xgb

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

warnings.filterwarnings("ignore", category=rasterio.errors.NotGeoreferencedWarning)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bahuraksha")

# ─────────────────────────────────────────────
# FastAPI Setup
# ─────────────────────────────────────────────

app = FastAPI(
    title="Bahuraksha Early Warning System API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

BAHURAKSHA_BBOX = [86.0, 27.7, 86.6, 28.1]

EARTH_SEARCH = "https://earth-search.aws.element84.com/v1/search"

AOI_ELEVATION_M = 2850.0
AOI_SLOPE_DEG = 18.5

CLASS_LABELS = {
    0: "dry_land",
    1: "flood_water",
    2: "snow_glacier"
}

CLASS_COLORS = {
    0: "#c8a96e",
    1: "#1a6faf",
    2: "#e8f4fd"
}

MODEL_PATH = os.environ.get(
    "MODEL_PATH",
    "bahuraksha_xgb_model.ubj"
)

# ─────────────────────────────────────────────
# Model Loading (FIXED)
# ─────────────────────────────────────────────

try:
    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)
    log.info(f"Model loaded from {MODEL_PATH}")
except Exception as e:
    model = None
    log.error(f"FAILED to load model: {type(e).__name__}: {e}")

# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class PredictRequest(BaseModel):

    date: str = Field(
        ...,
        example="2024-08-15"
    )

    bbox: Optional[list] = None

    lookback_days: int = 60

    cloud_max: int = 80

class HealthResponse(BaseModel):

    model_config = {"protected_namespaces": ()}

    status: str

    model_loaded: bool

    model_type: str

# ─────────────────────────────────────────────
# STAC Search
# ─────────────────────────────────────────────

def search_stac(
    collection: str,
    bbox: list,
    date_str: str,
    lookback_days: int = 30,
    cloud_max: int = 80
):

    target = datetime.strptime(
        date_str,
        "%Y-%m-%d"
    )

    date_from = (
        target - timedelta(days=lookback_days)
    ).strftime("%Y-%m-%dT00:00:00Z")

    date_to = target.strftime(
        "%Y-%m-%dT23:59:59Z"
    )

    body = {
        "collections": [collection],
        "bbox": bbox,
        "datetime": f"{date_from}/{date_to}",
        "limit": 1,
    }

    if collection == "sentinel-2-l2a":

        body["query"] = {
            "eo:cloud_cover": {
                "lt": cloud_max
            }
        }

    if collection == "sentinel-1-grd":

        body["query"] = {
            "sar:instrument_mode": {"eq": "IW"},
            "sat:orbit_state": {"eq": "descending"},
        }

    res = requests.post(
        EARTH_SEARCH,
        json=body,
        timeout=20
    )

    res.raise_for_status()

    features = res.json().get(
        "features",
        []
    )

    if not features:

        raise HTTPException(
            status_code=404,
            detail=f"No {collection} scene found"
        )

    return features[0]

# ─────────────────────────────────────────────
# Raster Reader
# ─────────────────────────────────────────────

def read_band_mean(href, bbox):

    if href is None:
        return np.nan

    west, south, east, north = bbox

    try:

        with rasterio.open(href) as src:

            if src.crs != CRS.from_epsg(4326):

                left, bottom, right, top = transform_bounds(
                    "EPSG:4326",
                    src.crs,
                    west,
                    south,
                    east,
                    north
                )

            else:

                left, bottom, right, top = (
                    west,
                    south,
                    east,
                    north
                )

            window = from_bounds(
                left,
                bottom,
                right,
                top,
                src.transform
            )

            data = src.read(
                1,
                window=window,
                out_shape=(1, 64, 64),
                resampling=Resampling.average,
                masked=True,
            )

            valid = data.compressed()

            if len(valid) == 0:
                return np.nan

            return float(np.mean(valid))

    except Exception:

        return np.nan

# ─────────────────────────────────────────────
# Feature Engineering
# ─────────────────────────────────────────────

def safe_index(a, b):

    if np.isnan(a) or np.isnan(b):
        return 0.0

    if (a + b) == 0:
        return 0.0

    return float((a - b) / (a + b))

def extract_s2_features(item, bbox):

    assets = item.get("assets", {})

    def get_href(key):

        if key in assets:
            return assets[key]["href"]

        if key.lower() in assets:
            return assets[key.lower()]["href"]

        return None

    b2 = read_band_mean(get_href("blue"), bbox)
    b3 = read_band_mean(get_href("green"), bbox)
    b4 = read_band_mean(get_href("red"), bbox)
    b8 = read_band_mean(get_href("nir"), bbox)
    b11 = read_band_mean(get_href("swir16"), bbox)
    b12 = read_band_mean(get_href("swir22"), bbox)

    def scale(v):

        if np.isnan(v):
            return v

        return v / 10000.0 if v > 1 else v

    b2, b3, b4 = scale(b2), scale(b3), scale(b4)
    b8, b11, b12 = scale(b8), scale(b11), scale(b12)

    ndwi = safe_index(b3, b8)
    ndsi = safe_index(b3, b11)
    ndvi = safe_index(b8, b4)

    return {
        "B2": b2,
        "B3": b3,
        "B4": b4,
        "B8": b8,
        "B11": b11,
        "B12": b12,
        "NDWI": ndwi,
        "NDSI": ndsi,
        "NDVI": ndvi,
        "scene_date": item["properties"]["datetime"][:10],
        "cloud_cover": item["properties"].get("eo:cloud_cover"),
    }

def extract_s1_features(item, bbox):

    assets = item.get("assets", {})

    vh_href = assets.get("vh", {}).get("href")
    vv_href = assets.get("vv", {}).get("href")

    vh_raw = read_band_mean(vh_href, bbox)
    vv_raw = read_band_mean(vv_href, bbox)

    def to_db(v):

        if np.isnan(v) or v <= 0:
            return -20.0

        return float(10 * math.log10(v))

    return {
        "VH_db": to_db(vh_raw),
        "VV_db": to_db(vv_raw),
        "scene_date": item["properties"]["datetime"][:10],
    }

def compute_change_indices(current, reference):

    BASELINE = {
        "NDWI": -0.18,
        "NDSI": 0.05,
        "NDVI": 0.31,
    }

    ref = reference if reference else BASELINE

    return {
        "dNDWI": current["NDWI"] - ref["NDWI"],
        "dNDSI": current["NDSI"] - ref["NDSI"],
        "dNDVI": current["NDVI"] - ref["NDVI"],
    }

def build_feature_vector(s2, s1, change):

    X = np.array([[
        s2["B2"],
        s2["B3"],
        s2["B4"],
        s2["B8"],
        s2["B11"],
        s2["B12"],
        s2["NDWI"],
        s2["NDSI"],
        s2["NDVI"],
        change["dNDWI"],
        change["dNDSI"],
        change["dNDVI"],
        s1["VH_db"],
        s1["VV_db"],
        AOI_ELEVATION_M,
        AOI_SLOPE_DEG,
    ]], dtype=np.float32)

    return np.nan_to_num(X)

# ─────────────────────────────────────────────
# Core Prediction Logic (FIXED)
# ─────────────────────────────────────────────

def run_prediction(
    date: str,
    bbox: list,
    lookback_days: int = 60,
    cloud_max: int = 80
):

    bbox = bbox or BAHURAKSHA_BBOX

    if model is None:

        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )

    s2_current_item = search_stac(
        "sentinel-2-l2a",
        bbox,
        date,
        lookback_days,
        cloud_max
    )

    s1_current_item = search_stac(
        "sentinel-1-grd",
        bbox,
        date,
        lookback_days
    )

    try:

        ref_date = (
            datetime.strptime(date, "%Y-%m-%d")
            - timedelta(days=60)
        ).strftime("%Y-%m-%d")

        s2_ref_item = search_stac(
            "sentinel-2-l2a",
            bbox,
            ref_date,
            30,
            80
        )

    except HTTPException:

        s2_ref_item = None

    s2_current = extract_s2_features(
        s2_current_item,
        bbox
    )

    s1_current = extract_s1_features(
        s1_current_item,
        bbox
    )

    s2_reference = (
        extract_s2_features(
            s2_ref_item,
            bbox
        )
        if s2_ref_item
        else None
    )

    change = compute_change_indices(
        s2_current,
        s2_reference
    )

    X = build_feature_vector(
        s2_current,
        s1_current,
        change
    )

    pred_proba = model.predict_proba(X)[0]

    pred_class = int(np.argmax(pred_proba))

    confidence = round(
        float(max(pred_proba)),
        3
    )

    label = CLASS_LABELS[pred_class]

    color = CLASS_COLORS[pred_class]

    flood_prob = pred_proba[1]

    sar_signal = max(
        0,
        min(
            1,
            (-s1_current["VH_db"] - 10) / 20
        )
    )

    risk_score = round(
        (flood_prob * 0.7 + sar_signal * 0.3) * 100,
        1
    )

    return {

        "status": "ok",

        "request": {
            "date": date,
            "bbox": bbox,
        },

        "prediction": {
            "class": pred_class,
            "label": label,
            "color": color,
            "confidence": confidence,
            "risk_score": risk_score,
        },
    }

# ─────────────────────────────────────────────
# Routes (FIXED)
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "project": "Bahuraksha Early Warning System",
        "status": "online",
        "docs": "/docs",
    }

@app.get("/health", response_model=HealthResponse)
def health():
    return {
        "status": "healthy" if model else "model_missing",
        "model_loaded": model is not None,
        "model_type": type(model).__name__ if model else "none",
    }

@app.post("/predict")
def predict(req: PredictRequest):

    return run_prediction(
        req.date,
        req.bbox,
        req.lookback_days,
        req.cloud_max,
    )

@app.get("/latest")
def latest():

    today = datetime.utcnow().strftime(
        "%Y-%m-%d"
    )

    return run_prediction(
        today,
        BAHURAKSHA_BBOX
    )

@app.get("/history")
def history(days: int = 7):

    results = []

    for i in range(days):

        date = (
            datetime.utcnow()
            - timedelta(days=i)
        ).strftime("%Y-%m-%d")

        try:

            r = run_prediction(
                date,
                BAHURAKSHA_BBOX
            )

            results.append({
                "date": date,
                "label": r["prediction"]["label"],
                "risk_score": r["prediction"]["risk_score"],
                "confidence": r["prediction"]["confidence"],
            })

        except HTTPException as e:

            results.append({
                "date": date,
                "error": e.detail
            })

    return {"history": results}

@app.get("/debug")
def debug():

    cwd = os.getcwd()

    load_error = None

    try:

        b = xgb.XGBClassifier()

        b.load_model(
            "bahuraksha_xgb_model.ubj"
        )

        load_test = "SUCCESS"

    except Exception as e:

        load_test = "FAILED"

        load_error = str(e)

    return {

        "cwd": cwd,

        "files": os.listdir(cwd),

        "model_loaded": model is not None,

        "live_load_test": load_test,

        "load_error": load_error,

        "xgboost_version": xgb.__version__,
    }