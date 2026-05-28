"""
Bahurakshaa Phase 5 API

Endpoints:
  POST /predict/flood
  POST /predict/landslide
  GET  /risk/zones
  POST /ingest/satellite
  GET  /health

Run:
  uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import STATIONS


ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "models"
RAW_RAINFALL = ROOT / "data" / "raw" / "rainfall"
RAW_DISCHARGE = ROOT / "data" / "raw" / "discharge"
RAW_SENTINEL = ROOT / "data" / "raw" / "sentinel"
RAW_DEM = ROOT / "data" / "raw" / "dem"
RAW_LANDUSE = ROOT / "data" / "raw" / "landuse"

FLOOD_MODEL_PATH = MODELS_DIR / "flood_model.pkl"
LANDSLIDE_MODEL_PATH = MODELS_DIR / "landslide_model.pkl"

BAGMATI_ZONES = [
    {
        "id": "z-1",
        "name": "Kathmandu Metro",
        "district": "Kathmandu",
        "lat": 27.7172,
        "lon": 85.3240,
        "population": 1442271,
    },
    {
        "id": "z-2",
        "name": "Lalitpur Sub-Metro",
        "district": "Lalitpur",
        "lat": 27.6588,
        "lon": 85.3247,
        "population": 284922,
    },
    {
        "id": "z-3",
        "name": "Bhaktapur Municipality",
        "district": "Bhaktapur",
        "lat": 27.6710,
        "lon": 85.4298,
        "population": 81748,
    },
    {
        "id": "z-4",
        "name": "Kirtipur Municipality",
        "district": "Kathmandu",
        "lat": 27.6783,
        "lon": 85.2775,
        "population": 65602,
    },
    {
        "id": "z-5",
        "name": "Budhanilkantha",
        "district": "Kathmandu",
        "lat": 27.7800,
        "lon": 85.3600,
        "population": 97042,
    },
    {
        "id": "z-6",
        "name": "Tokha Municipality",
        "district": "Kathmandu",
        "lat": 27.7500,
        "lon": 85.3100,
        "population": 126286,
    },
]

WORLDCOVER_CLASSES = {
    10: "tree_cover",
    20: "shrubland",
    30: "grassland",
    40: "cropland",
    50: "built_up",
    60: "bare_sparse",
    70: "snow_ice",
    80: "water",
    90: "wetland",
    95: "mangrove",
    100: "moss_lichen",
}

NDVI_PROXY = {
    "tree_cover": 0.75,
    "shrubland": 0.45,
    "grassland": 0.40,
    "cropland": 0.35,
    "built_up": 0.10,
    "bare_sparse": 0.05,
    "snow_ice": 0.00,
    "water": 0.00,
    "wetland": 0.50,
    "mangrove": 0.70,
    "moss_lichen": 0.20,
    "unknown": 0.20,
}


def _load_model_bundle(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")
    bundle = joblib.load(path)
    required = {"model", "model_name", "threshold", "feature_columns"}
    missing = required - set(bundle.keys())
    if missing:
        raise ValueError(f"Model bundle missing keys: {sorted(missing)}")
    return bundle


def _model_version(path: Path, model_name: str) -> str:
    try:
        ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    except Exception:
        ts = "unknown"
    return f"{model_name}:{path.name}:{ts}"


def _build_feature_row(payload: dict[str, Any], feature_columns: list[str]) -> pd.DataFrame:
    data = dict(payload)

    # Derive month/day_of_year from date when available.
    if "date" in data and data["date"] is not None:
        dt = pd.to_datetime(data["date"], errors="coerce")
        if pd.notna(dt):
            if data.get("month") is None:
                data["month"] = int(dt.month)
            if data.get("day_of_year") is None:
                data["day_of_year"] = int(dt.dayofyear)

    # Derive SAR ratio if missing and raw bands are present.
    if (
        data.get("sar_vv_vh_ratio_db") is None
        and ("sar_vv_db" in data and "sar_vh_db" in data)
    ):
        try:
            data["sar_vv_vh_ratio_db"] = float(data["sar_vv_db"]) - float(data["sar_vh_db"])
        except Exception:
            pass

    missing = [c for c in feature_columns if c not in data or data[c] is None]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required feature(s): {missing}",
        )

    row = {c: pd.to_numeric(pd.Series([data[c]]), errors="coerce").iloc[0] for c in feature_columns}
    if any(pd.isna(v) for v in row.values()):
        bad = [k for k, v in row.items() if pd.isna(v)]
        raise HTTPException(status_code=422, detail=f"Non-numeric/invalid feature(s): {bad}")

    return pd.DataFrame([row], columns=feature_columns)


def _risk_level(score: float) -> str:
    if score >= 0.78:
        return "evacuate"
    if score >= 0.58:
        return "warning"
    if score >= 0.32:
        return "watch"
    return "safe"


def _distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@lru_cache(maxsize=1)
def _load_daily_rainfall() -> pd.DataFrame:
    csv_path = RAW_RAINFALL / "gpm_bagmati_daily.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=503, detail=f"Missing rainfall CSV: {csv_path}")

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    date_col = "date" if "date" in df.columns else None
    if date_col is None:
        raise HTTPException(status_code=503, detail="Rainfall CSV missing 'date' column")

    rain_col = next(
        (c for c in df.columns if any(x in c for x in ["rain", "precip", "precipitation"])),
        None,
    )
    if rain_col is None:
        raise HTTPException(status_code=503, detail="Rainfall CSV missing rainfall/precip column")

    df["date"] = pd.to_datetime(df[date_col], errors="coerce").dt.normalize()
    df["rainfall_mm"] = pd.to_numeric(df[rain_col], errors="coerce")
    df = df.dropna(subset=["date"]).copy()

    daily = df.groupby("date")["rainfall_mm"].sum().reset_index().sort_values("date")
    daily["rf_1day"] = daily["rainfall_mm"]
    daily["rf_3day"] = daily["rainfall_mm"].rolling(3, min_periods=1).sum()
    daily["rf_7day"] = daily["rainfall_mm"].rolling(7, min_periods=1).sum()
    daily["rf_30day"] = daily["rainfall_mm"].rolling(30, min_periods=1).sum()
    return daily[["date", "rf_1day", "rf_3day", "rf_7day", "rf_30day"]]


@lru_cache(maxsize=1)
def _load_daily_discharge() -> pd.DataFrame:
    csv_path = RAW_DISCHARGE / "glofas_bagmati_daily.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=503, detail=f"Missing discharge CSV: {csv_path}")

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()
    if "date" not in df.columns:
        raise HTTPException(status_code=503, detail="Discharge CSV missing 'date' column")

    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.normalize()

    runoff_col = next((c for c in df.columns if any(x in c for x in ["runoff", "discharge"])), None)
    if runoff_col is None:
        surf = "surface_runoff_sum"
        sub = "sub_surface_runoff_sum"
        if surf in df.columns and sub in df.columns:
            df["runoff_total"] = (
                pd.to_numeric(df[surf], errors="coerce").fillna(0)
                + pd.to_numeric(df[sub], errors="coerce").fillna(0)
            )
            runoff_col = "runoff_total"
        else:
            raise HTTPException(status_code=503, detail="Discharge CSV missing runoff columns")

    sm_cols = [
        "volumetric_soil_water_layer_1",
        "volumetric_soil_water_layer_2",
        "volumetric_soil_water_layer_3",
        "volumetric_soil_water_layer_4",
    ]
    present_sm_cols = [c for c in sm_cols if c in df.columns]
    if present_sm_cols:
        df["soil_moisture_index"] = df[present_sm_cols].apply(pd.to_numeric, errors="coerce").mean(axis=1)
    else:
        rain_fallback = pd.to_numeric(df.get("total_precipitation_sum", 0), errors="coerce").fillna(0)
        proxy = rain_fallback.rolling(7, min_periods=1).mean()
        pmin, pmax = float(proxy.min()), float(proxy.max())
        if pmax > pmin:
            proxy = (proxy - pmin) / (pmax - pmin)
        else:
            proxy = proxy * 0
        df["soil_moisture_index"] = proxy

    daily = (
        df.groupby("date")[[runoff_col, "soil_moisture_index"]]
        .mean()
        .reset_index()
        .rename(columns={runoff_col: "discharge_proxy"})
        .sort_values("date")
    )
    daily["discharge_proxy"] = (
        pd.to_numeric(daily["discharge_proxy"], errors="coerce").fillna(0) * 3.5e9 / 86400
    ).clip(lower=0)
    return daily


@lru_cache(maxsize=1)
def _load_daily_sar() -> pd.DataFrame:
    csv_path = RAW_SENTINEL / "sentinel1_bagmati_daily.csv"
    rainfall_dates = _load_daily_rainfall()["date"]
    base = pd.DataFrame({"date": pd.to_datetime(rainfall_dates).dt.normalize().drop_duplicates()})

    if not csv_path.exists():
        base["sar_vv_db"] = -14.0
        base["sar_vh_db"] = -20.0
        base["sar_vv_vh_ratio_db"] = 6.0
        return base

    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()
    df["date"] = pd.to_datetime(df.get("date"), errors="coerce").dt.normalize()
    df = df.dropna(subset=["date"]).copy()

    vv_col = "sar_vv_db" if "sar_vv_db" in df.columns else ("vv" if "vv" in df.columns else None)
    vh_col = "sar_vh_db" if "sar_vh_db" in df.columns else ("vh" if "vh" in df.columns else None)
    if vv_col is None or vh_col is None:
        raise HTTPException(status_code=503, detail="SAR CSV missing VV/VH columns")

    df["sar_vv_db"] = pd.to_numeric(df[vv_col], errors="coerce")
    df["sar_vh_db"] = pd.to_numeric(df[vh_col], errors="coerce")
    if "sar_vv_vh_ratio_db" in df.columns:
        df["sar_vv_vh_ratio_db"] = pd.to_numeric(df["sar_vv_vh_ratio_db"], errors="coerce")
    else:
        df["sar_vv_vh_ratio_db"] = df["sar_vv_db"] - df["sar_vh_db"]

    daily = (
        df.groupby("date")[["sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db"]]
        .mean()
        .reset_index()
        .sort_values("date")
    )

    aligned = base.merge(daily, on="date", how="left").sort_values("date")
    for c in ["sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db"]:
        aligned[c] = aligned[c].interpolate(method="linear").ffill().bfill()
    return aligned


@lru_cache(maxsize=1)
def _zone_static_features() -> dict[str, dict[str, float]]:
    features: dict[str, dict[str, float]] = {}

    dem_tif = next((f for f in list(RAW_DEM.glob("*.tif")) + list(RAW_DEM.glob("*.hgt"))), None)
    landuse_tif = next((f for f in RAW_LANDUSE.glob("*.tif")), None)

    dem_src = None
    landuse_src = None
    dem_arr = slope_arr = aspect_arr = curv_arr = None

    try:
        if dem_tif is not None:
            import rasterio
            from rasterio.transform import rowcol

            dem_src = rasterio.open(dem_tif)
            dem_arr = dem_src.read(1).astype(float)
            nodata = dem_src.nodata or -9999
            dem_arr[dem_arr == nodata] = np.nan

            px = abs(dem_src.transform.a)
            res_m = px if px > 1 else px * 111320
            dy, dx = np.gradient(dem_arr, res_m)
            slope_arr = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2)))
            aspect_arr = np.degrees(np.arctan2(-dx, dy)) % 360
            curv_arr = np.gradient(dy, res_m)[0] + np.gradient(dx, res_m)[1]

        if landuse_tif is not None:
            import rasterio

            landuse_src = rasterio.open(landuse_tif)
    except Exception:
        dem_src = None
        landuse_src = None

    for zone in BAGMATI_ZONES:
        lat = float(zone["lat"])
        lon = float(zone["lon"])

        elevation_m = 1200.0
        slope_deg = 8.0
        aspect_deg = 120.0
        curvature = 0.0
        landuse_code = 50
        ndvi_proxy = NDVI_PROXY["built_up"]

        if dem_src is not None and dem_arr is not None and slope_arr is not None and aspect_arr is not None and curv_arr is not None:
            try:
                from rasterio.transform import rowcol

                r, c = rowcol(dem_src.transform, lon, lat)
                r = int(np.clip(r, 0, dem_arr.shape[0] - 1))
                c = int(np.clip(c, 0, dem_arr.shape[1] - 1))
                if not np.isnan(dem_arr[r, c]):
                    elevation_m = float(dem_arr[r, c])
                slope_deg = float(slope_arr[r, c])
                aspect_deg = float(aspect_arr[r, c])
                curvature = float(curv_arr[r, c])
            except Exception:
                pass

        if landuse_src is not None:
            try:
                from rasterio.transform import rowcol

                lc = landuse_src.read(1)
                r, c = rowcol(landuse_src.transform, lon, lat)
                r = int(np.clip(r, 0, lc.shape[0] - 1))
                c = int(np.clip(c, 0, lc.shape[1] - 1))
                landuse_code = int(lc[r, c])
                landuse_name = WORLDCOVER_CLASSES.get(landuse_code, "unknown")
                ndvi_proxy = float(NDVI_PROXY.get(landuse_name, 0.2))
            except Exception:
                pass

        dist_drainage_m = min(
            _distance_m(lat, lon, float(st["lat"]), float(st["lon"])) for st in STATIONS
        )

        features[str(zone["id"])] = {
            "elevation_m": elevation_m,
            "slope_deg": slope_deg,
            "aspect_deg": aspect_deg,
            "curvature": curvature,
            "landuse_code": float(landuse_code),
            "ndvi_proxy": ndvi_proxy,
            "dist_drainage_m": dist_drainage_m,
        }

    if dem_src is not None:
        dem_src.close()
    if landuse_src is not None:
        landuse_src.close()

    return features


class FloodPredictRequest(BaseModel):
    date: str | None = None
    lat: float
    lon: float
    rf_1day: float
    rf_3day: float
    rf_7day: float
    rf_30day: float
    discharge_proxy: float
    soil_moisture_index: float
    elevation_m: float
    slope_deg: float
    aspect_deg: float
    curvature: float
    sar_vv_db: float
    sar_vh_db: float
    sar_vv_vh_ratio_db: float | None = None
    month: int | None = None
    day_of_year: int | None = None


class LandslidePredictRequest(BaseModel):
    date: str | None = None
    lat: float
    lon: float
    rf_1day: float
    rf_3day: float
    rf_7day: float
    rf_30day: float
    elevation_m: float
    slope_deg: float
    aspect_deg: float
    curvature: float
    landuse_code: int
    ndvi_proxy: float
    dist_drainage_m: float
    month: int | None = None
    day_of_year: int | None = None


class PredictResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    model_name: str
    model_version: str
    threshold: float
    probability: float
    predicted_event: int
    risk_level: str


class SatelliteIngestRow(BaseModel):
    date: str
    sar_vv_db: float
    sar_vh_db: float
    sar_vv_vh_ratio_db: float | None = None
    source: str = "manual_api_ingest"


class SatelliteIngestRequest(BaseModel):
    rows: list[SatelliteIngestRow]


class ZoneRiskItem(BaseModel):
    zone_id: str
    zone_name: str
    district: str
    lat: float
    lon: float
    population: int
    flood_probability: float
    landslide_probability: float
    rainfall_score: float
    composite_score: float
    risk_level: str
    flood_predicted_event: int
    landslide_predicted_event: int
    data_quality: str


class LiveZoneRiskResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    requested_date: str | None
    data_date: str
    generated_at_utc: str
    source: str
    formula: str
    model_versions: dict[str, str]
    zones: list[ZoneRiskItem]


app = FastAPI(title="Bahurakshaa ML API", version="0.1.0")

DEFAULT_CORS_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://192.168.1.7:8080",
    "http://192.168.1.79:8080",
]

cors_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
] or DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    flood_bundle = _load_model_bundle(FLOOD_MODEL_PATH)
    landslide_bundle = _load_model_bundle(LANDSLIDE_MODEL_PATH)
except Exception as exc:
    # Fail fast on startup when model artifacts are missing/broken.
    raise RuntimeError(f"Failed to load model bundles: {exc}") from exc


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "utc": datetime.now(timezone.utc).isoformat(),
        "flood_model": flood_bundle["model_name"],
        "landslide_model": landslide_bundle["model_name"],
    }


@app.post("/predict/flood", response_model=PredictResponse)
def predict_flood(payload: FloodPredictRequest) -> PredictResponse:
    features = _build_feature_row(payload.model_dump(), flood_bundle["feature_columns"])
    prob = float(flood_bundle["model"].predict_proba(features)[0, 1])
    thr = float(flood_bundle["threshold"])
    pred = int(prob >= thr)
    return PredictResponse(
        model_name=str(flood_bundle["model_name"]),
        model_version=_model_version(FLOOD_MODEL_PATH, str(flood_bundle["model_name"])),
        threshold=thr,
        probability=prob,
        predicted_event=pred,
        risk_level=_risk_level(prob),
    )


@app.post("/predict/landslide", response_model=PredictResponse)
def predict_landslide(payload: LandslidePredictRequest) -> PredictResponse:
    features = _build_feature_row(payload.model_dump(), landslide_bundle["feature_columns"])
    prob = float(landslide_bundle["model"].predict_proba(features)[0, 1])
    thr = float(landslide_bundle["threshold"])
    pred = int(prob >= thr)
    return PredictResponse(
        model_name=str(landslide_bundle["model_name"]),
        model_version=_model_version(LANDSLIDE_MODEL_PATH, str(landslide_bundle["model_name"])),
        threshold=thr,
        probability=prob,
        predicted_event=pred,
        risk_level=_risk_level(prob),
    )


@app.get("/risk/zones")
def risk_zones(
    flood_prob: float = Query(..., ge=0.0, le=1.0),
    landslide_prob: float = Query(..., ge=0.0, le=1.0),
    rainfall_score: float = Query(..., ge=0.0, le=1.0),
    zone_name: str = "Bagmati Zone",
) -> dict[str, Any]:
    # Composite score formula from project phase definition.
    composite = float(0.40 * flood_prob + 0.40 * landslide_prob + 0.20 * rainfall_score)
    return {
        "zone": zone_name,
        "composite_score": composite,
        "composite_risk_level": _risk_level(composite),
        "formula": "0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score",
        "inputs": {
            "flood_prob": flood_prob,
            "landslide_prob": landslide_prob,
            "rainfall_score": rainfall_score,
        },
    }


@app.post("/ingest/satellite")
def ingest_satellite(payload: SatelliteIngestRequest) -> dict[str, Any]:
    RAW_SENTINEL.mkdir(parents=True, exist_ok=True)
    out_path = RAW_SENTINEL / "satellite_ingest_log.jsonl"

    written = 0
    with out_path.open("a", encoding="utf-8") as f:
        for row in payload.rows:
            r = row.model_dump()
            if r.get("sar_vv_vh_ratio_db") is None:
                r["sar_vv_vh_ratio_db"] = float(r["sar_vv_db"]) - float(r["sar_vh_db"])
            r["ingested_at_utc"] = datetime.now(timezone.utc).isoformat()
            f.write(json.dumps(r) + "\n")
            written += 1

    return {
        "status": "ok",
        "rows_ingested": written,
        "log_file": str(out_path),
    }


@app.get("/risk/zones/live", response_model=LiveZoneRiskResponse)
def risk_zones_live(date: str | None = Query(None, description="Optional target date (YYYY-MM-DD).")) -> LiveZoneRiskResponse:
    rainfall = _load_daily_rainfall()
    discharge = _load_daily_discharge()
    sar = _load_daily_sar()

    merged = (
        rainfall.merge(discharge, on="date", how="inner")
        .merge(sar, on="date", how="inner")
        .dropna(
            subset=[
                "rf_1day",
                "rf_3day",
                "rf_7day",
                "rf_30day",
                "discharge_proxy",
                "soil_moisture_index",
                "sar_vv_db",
                "sar_vh_db",
                "sar_vv_vh_ratio_db",
            ]
        )
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
    rf1 = float(row["rf_1day"])
    rf3 = float(row["rf_3day"])
    rainfall_score = float(np.clip((0.7 * rf1 + 0.3 * (rf3 / 3.0)) / 100.0, 0.0, 1.0))
    sar_has_observed = (RAW_SENTINEL / "sentinel1_bagmati_daily.csv").exists()
    dem_has_observed = any(list(RAW_DEM.glob("*.tif")) + list(RAW_DEM.glob("*.hgt")))
    landuse_has_observed = any(RAW_LANDUSE.glob("*.tif"))

    quality_score = int(sar_has_observed) + int(dem_has_observed) + int(landuse_has_observed)
    if quality_score >= 3:
        data_quality = "high"
    elif quality_score >= 2:
        data_quality = "medium"
    else:
        data_quality = "low"

    static_feats = _zone_static_features()
    zones: list[ZoneRiskItem] = []
    for zone in BAGMATI_ZONES:
        zid = str(zone["id"])
        sf = static_feats[zid]

        shared = {
            "date": data_date,
            "lat": float(zone["lat"]),
            "lon": float(zone["lon"]),
            "rf_1day": rf1,
            "rf_3day": float(row["rf_3day"]),
            "rf_7day": float(row["rf_7day"]),
            "rf_30day": float(row["rf_30day"]),
            "elevation_m": sf["elevation_m"],
            "slope_deg": sf["slope_deg"],
            "aspect_deg": sf["aspect_deg"],
            "curvature": sf["curvature"],
        }

        flood_payload = {
            **shared,
            "discharge_proxy": float(row["discharge_proxy"]),
            "soil_moisture_index": float(row["soil_moisture_index"]),
            "sar_vv_db": float(row["sar_vv_db"]),
            "sar_vh_db": float(row["sar_vh_db"]),
            "sar_vv_vh_ratio_db": float(row["sar_vv_vh_ratio_db"]),
        }
        flood_features = _build_feature_row(flood_payload, flood_bundle["feature_columns"])
        flood_prob = float(flood_bundle["model"].predict_proba(flood_features)[0, 1])
        flood_pred = int(flood_prob >= float(flood_bundle["threshold"]))

        landslide_payload = {
            **shared,
            "landuse_code": int(round(sf["landuse_code"])),
            "ndvi_proxy": float(sf["ndvi_proxy"]),
            "dist_drainage_m": float(sf["dist_drainage_m"]),
        }
        landslide_features = _build_feature_row(landslide_payload, landslide_bundle["feature_columns"])
        landslide_prob = float(landslide_bundle["model"].predict_proba(landslide_features)[0, 1])
        landslide_pred = int(landslide_prob >= float(landslide_bundle["threshold"]))

        composite = float(0.40 * flood_prob + 0.40 * landslide_prob + 0.20 * rainfall_score)

        zones.append(
            ZoneRiskItem(
                zone_id=zid,
                zone_name=str(zone["name"]),
                district=str(zone["district"]),
                lat=float(zone["lat"]),
                lon=float(zone["lon"]),
                population=int(zone["population"]),
                flood_probability=flood_prob,
                landslide_probability=landslide_prob,
                rainfall_score=rainfall_score,
                composite_score=composite,
                risk_level=_risk_level(composite),
                flood_predicted_event=flood_pred,
                landslide_predicted_event=landslide_pred,
                data_quality=data_quality,
            )
        )

    zones = sorted(zones, key=lambda z: z.composite_score, reverse=True)
    return LiveZoneRiskResponse(
        requested_date=date,
        data_date=data_date,
        generated_at_utc=datetime.now(timezone.utc).isoformat(),
        source="root_api_daily_feature_aggregation",
        formula="0.40*flood_prob + 0.40*landslide_prob + 0.20*rainfall_score",
        model_versions={
            "flood_model": _model_version(FLOOD_MODEL_PATH, str(flood_bundle["model_name"])),
            "landslide_model": _model_version(LANDSLIDE_MODEL_PATH, str(landslide_bundle["model_name"])),
        },
        zones=zones,
    )
