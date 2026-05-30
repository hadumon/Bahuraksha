"""Bahuraksha Early Warning System — Unified API (STAC + CSV models)."""

import hashlib
import json
import logging
import os
import time
import uuid
import warnings
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pythonjsonlogger.json import JsonFormatter
from starlette.middleware.base import BaseHTTPMiddleware

import config
from notifications import send_whatsapp_alert
from satellite import (
    BAHURAKSHA_BBOX, search_stac, extract_s2_features, extract_s1_features,
    compute_change_indices, build_feature_vector, get_dem_features,
    CLASS_LABELS, CLASS_COLORS,
)
from csv_models import (
    _load_model_bundle, _model_version, _build_feature_row, _risk_level,
    load_daily_rainfall, load_daily_discharge, load_daily_sar,
    zone_static_features,
    FloodPredictRequest, LandslidePredictRequest, PredictResponse,
    SatelliteIngestRequest, SatelliteIngestRow,
    ZoneRiskItem, LiveZoneRiskResponse,
    BAGMATI_ZONES, NDVI_PROXY, WORLDCOVER_CLASSES,
)

warnings.filterwarnings("ignore", category=rasterio.errors.NotGeoreferencedWarning)
log_handler = logging.StreamHandler()
log_handler.setFormatter(JsonFormatter(fmt="%(asctime)s %(name)s %(levelname)s %(message)s"))
logging.basicConfig(level=logging.INFO, handlers=[log_handler])
log = logging.getLogger("bahuraksha")

app = FastAPI(title="Bahuraksha Early Warning System", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

RATE_LIMIT = os.getenv("BAHURAKSHA_RATE_LIMIT", "30/minute")
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

FLOOD_MODEL_PATH = config.MODELS_DIR / "flood_model.pkl"
LANDSLIDE_MODEL_PATH = config.MODELS_DIR / "landslide_model.pkl"

# ─── API key authentication ───────────────────────────────────────────────────
API_KEY = os.getenv("BAHURAKSHA_API_KEY", "")

class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if API_KEY:
            auth_header = request.headers.get("X-API-Key", "")
            if auth_header != API_KEY:
                if request.url.path not in ("/", "/health", "/ready", "/version", "/docs", "/openapi.json"):
                    return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})
        return await call_next(request)

app.add_middleware(APIKeyMiddleware)

# ─── Request-ID logging ───────────────────────────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = str(uuid.uuid4())[:8]
        start = time.time()
        response = await call_next(request)
        elapsed = time.time() - start
        log.info("[%s] %s %s → %s (%.3fs)", rid, request.method, request.url.path, response.status_code, elapsed)
        response.headers["X-Request-ID"] = rid
        response.headers["X-Response-Time-Ms"] = str(round(elapsed * 1000))
        return response

app.add_middleware(RequestIDMiddleware)

# ─── Simple in-memory cache ──────────────────────────────────────────────────
CACHE_TTL = int(os.getenv("BAHURAKSHA_CACHE_TTL", "300"))
_cache: dict[str, tuple[float, Any]] = {}

def cached(key: str, ttl: int = CACHE_TTL):
    now = time.time()
    entry = _cache.get(key)
    if entry and (now - entry[0]) < ttl:
        return entry[1]
    return None

def set_cache(key: str, value: Any, ttl: int = CACHE_TTL):
    _cache[key] = (time.time(), value)

def cache_key(*args, **kwargs) -> str:
    raw = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()

# ─── Model loading ────────────────────────────────────────────────────────────
try:
    flood_bundle = _load_model_bundle(FLOOD_MODEL_PATH)
    landslide_bundle = _load_model_bundle(LANDSLIDE_MODEL_PATH)
    log.info("Both model bundles loaded successfully")
except Exception as e:
    log.error(f"Failed to load model bundles: {e}")
    flood_bundle = None
    landslide_bundle = None


@app.get("/")
@limiter.limit("60/minute")
def root(request: Request):
    return {"project": "Bahuraksha Early Warning System", "status": "online", "docs": "/docs"}


@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request) -> dict[str, Any]:
    return {
        "status": "healthy" if (flood_bundle and landslide_bundle) else "model_missing",
        "flood_model": flood_bundle["model_name"] if flood_bundle else None,
        "landslide_model": landslide_bundle["model_name"] if landslide_bundle else None,
    }


@app.get("/ready")
@limiter.limit("60/minute")
def ready(request: Request):
    if not flood_bundle or not landslide_bundle:
        raise HTTPException(status_code=503, detail="Models not loaded")
    return {"status": "ready", "flood_model_loaded": True, "landslide_model_loaded": True}


@app.get("/version")
@limiter.limit("60/minute")
def version(request: Request) -> dict[str, Any]:
    return {
        "api_version": app.version,
        "flood_model": _model_version(FLOOD_MODEL_PATH, str(flood_bundle["model_name"])) if flood_bundle else None,
        "landslide_model": _model_version(LANDSLIDE_MODEL_PATH, str(landslide_bundle["model_name"])) if landslide_bundle else None,
        "flood_threshold": float(flood_bundle["threshold"]) if flood_bundle else None,
        "landslide_threshold": float(landslide_bundle["threshold"]) if landslide_bundle else None,
    }


@app.post("/predict/flood", response_model=PredictResponse)
@limiter.limit("20/minute")
def predict_flood(request: Request, payload: FloodPredictRequest) -> PredictResponse:
    if not flood_bundle:
        raise HTTPException(status_code=503, detail="Flood model not loaded")
    features = _build_feature_row(payload.model_dump(), flood_bundle["feature_columns"])
    prob = float(flood_bundle["model"].predict_proba(features)[0, 1])
    thr = float(flood_bundle["threshold"])
    pred = int(prob >= thr)
    return PredictResponse(
        model_name=str(flood_bundle["model_name"]),
        model_version=_model_version(FLOOD_MODEL_PATH, str(flood_bundle["model_name"])),
        threshold=thr, probability=prob, predicted_event=pred, risk_level=_risk_level(prob),
    )


@app.post("/predict/landslide", response_model=PredictResponse)
@limiter.limit("20/minute")
def predict_landslide(request: Request, payload: LandslidePredictRequest) -> PredictResponse:
    if not landslide_bundle:
        raise HTTPException(status_code=503, detail="Landslide model not loaded")
    features = _build_feature_row(payload.model_dump(), landslide_bundle["feature_columns"])
    prob = float(landslide_bundle["model"].predict_proba(features)[0, 1])
    thr = float(landslide_bundle["threshold"])
    pred = int(prob >= thr)
    return PredictResponse(
        model_name=str(landslide_bundle["model_name"]),
        model_version=_model_version(LANDSLIDE_MODEL_PATH, str(landslide_bundle["model_name"])),
        threshold=thr, probability=prob, predicted_event=pred, risk_level=_risk_level(prob),
    )


@app.get("/risk/zones")
@limiter.limit("30/minute")
def risk_zones(
    request: Request,
    flood_prob: float = Query(..., ge=0.0, le=1.0),
    landslide_prob: float = Query(..., ge=0.0, le=1.0),
    rainfall_score: float = Query(..., ge=0.0, le=1.0),
    zone_name: str = "Bagmati Zone",
) -> dict[str, Any]:
    composite = float(0.40 * flood_prob + 0.40 * landslide_prob + 0.20 * rainfall_score)
    return {
        "zone": zone_name, "composite_score": composite,
        "composite_risk_level": _risk_level(composite),
        "formula": "0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score",
        "inputs": {"flood_prob": flood_prob, "landslide_prob": landslide_prob, "rainfall_score": rainfall_score},
    }


@app.post("/ingest/satellite")
@limiter.limit("5/minute")
def ingest_satellite(request: Request, payload: SatelliteIngestRequest) -> dict[str, Any]:
    config.RAW_SENTINEL.mkdir(parents=True, exist_ok=True)
    out_path = config.RAW_SENTINEL / "satellite_ingest_log.jsonl"
    written = 0
    with out_path.open("a", encoding="utf-8") as f:
        for row in payload.rows:
            r = row.model_dump()
            if r.get("sar_vv_vh_ratio_db") is None:
                r["sar_vv_vh_ratio_db"] = float(r["sar_vv_db"]) - float(r["sar_vh_db"])
            r["ingested_at_utc"] = datetime.now(timezone.utc).isoformat()
            f.write(json.dumps(r) + "\n")
            written += 1
    return {"status": "ok", "rows_ingested": written, "log_file": str(out_path)}


@app.get("/risk/zones/live", response_model=LiveZoneRiskResponse)
@limiter.limit("20/minute")
def risk_zones_live(request: Request, date: str | None = Query(None, description="Optional target date (YYYY-MM-DD).")) -> LiveZoneRiskResponse:
    ck = cache_key("risk_zones_live", date)
    hit = cached(ck)
    if hit is not None:
        return LiveZoneRiskResponse(**hit)

    if not flood_bundle or not landslide_bundle:
        raise HTTPException(status_code=503, detail="Models not loaded")

    rainfall = load_daily_rainfall()
    discharge = load_daily_discharge()
    sar = load_daily_sar()

    merged = (
        rainfall.merge(discharge, on="date", how="inner")
        .merge(sar, on="date", how="inner")
        .dropna(subset=["rf_1day", "rf_3day", "rf_7day", "rf_30day", "discharge_proxy", "soil_moisture_index", "sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db"])
        .sort_values("date")
    )
    if merged.empty:
        raise HTTPException(status_code=503, detail="No overlapping rainfall/discharge/SAR data available")

    if date is not None:
        target = pd.to_datetime(date, errors="coerce")
        if pd.isna(target):
            raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD")
        candidates = merged[merged["date"] <= target]
        if candidates.empty:
            raise HTTPException(status_code=422, detail="No data available on or before requested date")
        row = candidates.iloc[-1]
    else:
        row = merged.iloc[-1]

    data_date = pd.Timestamp(row["date"]).date().isoformat()
    rf1, rf3 = float(row["rf_1day"]), float(row["rf_3day"])
    rainfall_score = float(np.clip((0.7 * rf1 + 0.3 * (rf3 / 3.0)) / 100.0, 0.0, 1.0))

    sar_has_observed = (config.RAW_SENTINEL / "sentinel1_bagmati_daily.csv").exists()
    dem_has_observed = any(list(config.RAW_DEM.glob("*.tif")) + list(config.RAW_DEM.glob("*.hgt")))
    landuse_has_observed = any(config.RAW_LANDUSE.glob("*.tif"))
    quality_score = int(sar_has_observed) + int(dem_has_observed) + int(landuse_has_observed)
    data_quality = "high" if quality_score >= 3 else ("medium" if quality_score >= 2 else "low")

    static_feats = zone_static_features()
    zones_list: list[ZoneRiskItem] = []
    for zone in BAGMATI_ZONES:
        zid, sf = str(zone["id"]), static_feats[str(zone["id"])]
        shared = {
            "date": data_date, "lat": float(zone["lat"]), "lon": float(zone["lon"]),
            "rf_1day": rf1, "rf_3day": float(row["rf_3day"]),
            "rf_7day": float(row["rf_7day"]), "rf_30day": float(row["rf_30day"]),
            "elevation_m": sf["elevation_m"], "slope_deg": sf["slope_deg"],
            "aspect_deg": sf["aspect_deg"], "curvature": sf["curvature"],
        }

        flood_payload = {**shared, "discharge_proxy": float(row["discharge_proxy"]),
            "soil_moisture_index": float(row["soil_moisture_index"]),
            "sar_vv_db": float(row["sar_vv_db"]), "sar_vh_db": float(row["sar_vh_db"]),
            "sar_vv_vh_ratio_db": float(row["sar_vv_vh_ratio_db"])}
        flood_features = _build_feature_row(flood_payload, flood_bundle["feature_columns"])
        flood_prob = float(flood_bundle["model"].predict_proba(flood_features)[0, 1])
        flood_pred = int(flood_prob >= float(flood_bundle["threshold"]))

        landslide_payload = {**shared, "landuse_code": int(round(sf["landuse_code"])),
            "ndvi_proxy": float(sf["ndvi_proxy"]), "dist_drainage_m": float(sf["dist_drainage_m"])}
        landslide_features = _build_feature_row(landslide_payload, landslide_bundle["feature_columns"])
        landslide_prob = float(landslide_bundle["model"].predict_proba(landslide_features)[0, 1])
        landslide_pred = int(landslide_prob >= float(landslide_bundle["threshold"]))

        composite = float(0.40 * flood_prob + 0.40 * landslide_prob + 0.20 * rainfall_score)

        zones_list.append(ZoneRiskItem(
            zone_id=zid, zone_name=str(zone["name"]), district=str(zone["district"]),
            lat=float(zone["lat"]), lon=float(zone["lon"]), population=int(zone["population"]),
            flood_probability=flood_prob, landslide_probability=landslide_prob,
            rainfall_score=rainfall_score, composite_score=composite,
            risk_level=_risk_level(composite),
            flood_predicted_event=flood_pred, landslide_predicted_event=landslide_pred,
            data_quality=data_quality,
        ))

    zones_list.sort(key=lambda z: z.composite_score, reverse=True)
    result = LiveZoneRiskResponse(
        requested_date=date, data_date=data_date,
        generated_at_utc=datetime.now(timezone.utc).isoformat(),
        source="bahuraksha_api_daily_feature_aggregation",
        formula="0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score",
        model_versions={
            "flood_model": _model_version(FLOOD_MODEL_PATH, str(flood_bundle["model_name"])),
            "landslide_model": _model_version(LANDSLIDE_MODEL_PATH, str(landslide_bundle["model_name"])),
        },
        zones=zones_list,
    )
    set_cache(ck, result.model_dump())
    return result


@app.post("/debug/features")
@limiter.limit("10/minute")
def debug_features(request: Request, date: str, bbox: list | None = None, lookback_days: int = 60, cloud_max: int = 80):
    bbox = bbox or BAHURAKSHA_BBOX
    s2_item = search_stac("sentinel-2-l2a", bbox, date, lookback_days, cloud_max)
    s1_item = search_stac("sentinel-1-grd", bbox, date, lookback_days)
    s2 = extract_s2_features(s2_item, bbox)
    s1 = extract_s1_features(s1_item, bbox)
    change = compute_change_indices(s2, None)
    dem = get_dem_features(bbox)
    X = build_feature_vector(s2, s1, change, elevation_m=dem["elevation_m"], slope_deg=dem["slope_deg"])
    return {"date": date, "bbox": bbox, "dem": dem, "s2": s2, "s1": s1, "change": change, "feature_vector": X[0].tolist()}


@app.get("/debug")
@limiter.limit("10/minute")
def debug(request: Request) -> dict[str, Any]:
    cwd = os.getcwd()
    return {
        "cwd": cwd, "files": os.listdir(cwd),
        "flood_model_loaded": flood_bundle is not None,
        "landslide_model_loaded": landslide_bundle is not None,
    }


@app.get("/debug/info")
@limiter.limit("10/minute")
def debug_info(request: Request) -> dict[str, Any]:
    def _file_info(path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        return {
            "path": str(path.relative_to(config.ROOT)),
            "size_bytes": path.stat().st_size,
            "last_modified_utc": mtime.isoformat(),
            "age_hours": round((datetime.now(timezone.utc) - mtime).total_seconds() / 3600, 2),
        }

    csv_files = list(config.RAW_RAINFALL.glob("*.csv")) + list(config.RAW_DISCHARGE.glob("*.csv")) + list(config.RAW_SENTINEL.glob("*.csv"))
    dem_files = list(config.RAW_DEM.rglob("*"))
    landuse_files = list(config.RAW_LANDUSE.rglob("*"))

    return {
        "models": {
            "flood": _model_version(FLOOD_MODEL_PATH, str(flood_bundle["model_name"])) if flood_bundle else None,
            "landslide": _model_version(LANDSLIDE_MODEL_PATH, str(landslide_bundle["model_name"])) if landslide_bundle else None,
        },
        "csv_data": {
            "total_files": len(csv_files),
            "files": [_file_info(f) for f in sorted(csv_files)[:20]],
            "data_dir_size_mb": round(sum(f.stat().st_size for f in csv_files) / 1e6, 2),
        },
        "dem_data": {str(f.relative_to(config.ROOT)): _file_info(f) for f in sorted(dem_files) if f.is_file()},
        "landuse_data": {str(f.relative_to(config.ROOT)): _file_info(f) for f in sorted(landuse_files) if f.is_file()},
        "cache_entries": len(_cache),
        "rate_limit": RATE_LIMIT,
        "api_key_enabled": bool(API_KEY),
        "cache_ttl_seconds": CACHE_TTL,
    }


class WhatsAppNotificationRequest(BaseModel):
    zone: str = Field(..., description="Affected zone name")
    title: str = Field(..., max_length=200, description="Alert title")
    message: str = Field(..., max_length=1000, description="Alert body text")
    severity: str = Field(default="watch", pattern=r"^(safe|watch|warning|evacuate)$")
    to_number: str | None = Field(default=None, description="Recipient phone number (E.164 format), defaults to DEMO_WHATSAPP_NUMBER")


@app.post("/notify/whatsapp", response_model=dict)
@limiter.limit("20/minute")
def notify_whatsapp(request: Request, payload: WhatsAppNotificationRequest) -> dict:
    """Send a WhatsApp alert via Twilio (or simulated fallback)."""
    result = send_whatsapp_alert(
        title=payload.title,
        message=payload.message,
        zone=payload.zone,
        severity=payload.severity,
        to_number=payload.to_number,
    )
    result["severity"] = payload.severity
    result["zone"] = payload.zone
    log.info("WhatsApp notification: %s", result)
    return result
