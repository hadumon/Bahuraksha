"""STAC satellite feature extraction — search, raster read, feature engineering."""

import math
import logging
from datetime import datetime, timedelta

import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.crs import CRS
from rasterio.warp import transform_bounds
import requests

from fastapi import HTTPException

log = logging.getLogger("bahuraksha")

BAHURAKSHA_BBOX = [86.0, 27.7, 86.6, 28.1]
EARTH_SEARCH = "https://earth-search.aws.element84.com/v1/search"

AOI_ELEVATION_M = 2850.0
AOI_SLOPE_DEG = 18.5
DEM_COLLECTION = "cop-dem-glo-30"

CLASS_LABELS = {0: "dry_land", 1: "flood_water", 2: "snow_glacier"}
CLASS_COLORS = {0: "#c8a96e", 1: "#1a6faf", 2: "#e8f4fd"}


def search_stac(collection: str, bbox: list, date_str: str, lookback_days: int = 30, cloud_max: int = 80):
    target = datetime.strptime(date_str, "%Y-%m-%d")
    date_from = (target - timedelta(days=lookback_days)).strftime("%Y-%m-%dT00:00:00Z")
    date_to = target.strftime("%Y-%m-%dT23:59:59Z")

    body = {"collections": [collection], "bbox": bbox, "datetime": f"{date_from}/{date_to}", "limit": 1}

    if collection == "sentinel-2-l2a":
        body["query"] = {"eo:cloud_cover": {"lt": cloud_max}}
    if collection == "sentinel-1-grd":
        body["query"] = {"sar:instrument_mode": {"eq": "IW"}, "sat:orbit_state": {"eq": "descending"}}

    res = requests.post(EARTH_SEARCH, json=body, timeout=20)
    res.raise_for_status()
    features = res.json().get("features", [])

    if not features:
        raise HTTPException(status_code=404, detail=f"No {collection} scene found")

    return features[0]


def read_band_mean(href, bbox):
    if href is None:
        return np.nan

    west, south, east, north = bbox

    try:
        with rasterio.open(href) as src:
            if src.crs != CRS.from_epsg(4326):
                left, bottom, right, top = transform_bounds("EPSG:4326", src.crs, west, south, east, north)
            else:
                left, bottom, right, top = west, south, east, north

            window = from_bounds(left, bottom, right, top, src.transform)
            data = src.read(1, window=window, out_shape=(1, 64, 64), resampling=Resampling.average, masked=True)
            valid = data.compressed()

            if len(valid) == 0:
                return np.nan

            return float(np.mean(valid))
    except Exception:
        return np.nan


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
        "B2": b2, "B3": b3, "B4": b4, "B8": b8, "B11": b11, "B12": b12,
        "NDWI": ndwi, "NDSI": ndsi, "NDVI": ndvi,
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

    return {"VH_db": to_db(vh_raw), "VV_db": to_db(vv_raw), "scene_date": item["properties"]["datetime"][:10]}


def compute_change_indices(current, reference):
    BASELINE = {"NDWI": -0.18, "NDSI": 0.05, "NDVI": 0.31}
    ref = reference if reference else BASELINE
    return {"dNDWI": current["NDWI"] - ref["NDWI"], "dNDSI": current["NDSI"] - ref["NDSI"], "dNDVI": current["NDVI"] - ref["NDVI"]}


def build_feature_vector(s2, s1, change, elevation_m=None, slope_deg=None):
    if elevation_m is None:
        elevation_m = AOI_ELEVATION_M
    if slope_deg is None:
        slope_deg = AOI_SLOPE_DEG

    X = np.array([[
        s2["B2"], s2["B3"], s2["B4"], s2["B8"], s2["B11"], s2["B12"],
        s2["NDWI"], s2["NDSI"], s2["NDVI"],
        change["dNDWI"], change["dNDSI"], change["dNDVI"],
        s1["VH_db"], s1["VV_db"],
        elevation_m, slope_deg,
    ]], dtype=np.float32)

    return np.nan_to_num(X)


def get_dem_features(bbox):
    try:
        item = search_stac(DEM_COLLECTION, bbox, "2024-01-01", 365, 100)
    except HTTPException:
        log.warning("No DEM scene found, using hardcoded defaults")
        return {"elevation_m": AOI_ELEVATION_M, "slope_deg": AOI_SLOPE_DEG}

    href = item.get("assets", {}).get("data", {}).get("href")
    if not href:
        log.warning("DEM asset missing, using hardcoded defaults")
        return {"elevation_m": AOI_ELEVATION_M, "slope_deg": AOI_SLOPE_DEG}

    try:
        with rasterio.open(href) as src:
            west, south, east, north = bbox
            if src.crs != CRS.from_epsg(4326):
                left, bottom, right, top = transform_bounds("EPSG:4326", src.crs, west, south, east, north)
            else:
                left, bottom, right, top = west, south, east, north

            window = from_bounds(left, bottom, right, top, src.transform)
            elev = src.read(1, window=window, masked=True)
            valid = elev.compressed()
            if len(valid) == 0:
                log.warning("No valid DEM pixels, using hardcoded defaults")
                return {"elevation_m": AOI_ELEVATION_M, "slope_deg": AOI_SLOPE_DEG}

            elevation_m = float(np.mean(valid))

            dy, dx = np.gradient(elev.filled(np.nan), src.res[0], src.res[1])
            slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
            valid_slope = slope_rad[~np.isnan(slope_rad)]
            slope_deg = float(np.degrees(np.mean(valid_slope))) if len(valid_slope) > 0 else AOI_SLOPE_DEG

            return {"elevation_m": round(elevation_m, 1), "slope_deg": round(slope_deg, 1)}
    except Exception as e:
        log.warning(f"DEM read failed ({e}), using hardcoded defaults")
        return {"elevation_m": AOI_ELEVATION_M, "slope_deg": AOI_SLOPE_DEG}
