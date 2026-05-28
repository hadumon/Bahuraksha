"""
scripts/05_preprocess.py — fixed version

Fixes applied:
  1. BIPAD dates extend to 2025 — expanded GPM range to include 2025
  2. GPM CSV has multiple rows per day (30-min intervals) — aggregate to daily
  3. Municipality name fuzzy matching improved for actual BIPAD values
"""

import sys
import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import (
    RAW_BIPAD, RAW_RAINFALL, RAW_DISCHARGE, RAW_DEM, RAW_LANDUSE, RAW_SENTINEL,
    DATA_TRAINING, DATA_PROCESSED, BBOX, STATIONS, GPM_MONTHS, BASIN_BOUNDARY_GEOJSON
)

BAGMATI_DISTRICTS = [
    "kathmandu", "sindhupalchok", "bhaktapur", "lalitpur",
    "kavrepalanchok", "nuwakot", "rasuwa", "dhading",
    "makwanpur", "chitawan"
]

# Exact municipality names from your BIPAD data → coordinates
MUNICIPALITY_COORDS = {
    # from your actual BIPAD output
    "kageshwori manahora":          (27.7456, 85.3833),
    "kageshwori manohara":          (27.7456, 85.3833),
    "jugal":                        (27.8833, 85.6833),
    "balefi":                       (27.7833, 85.7167),
    "kathmandu":                    (27.7172, 85.3240),
    "bhotekoshi":                   (27.8167, 85.8833),
    "lisangkhu pakhar":             (27.9167, 85.7500),
    "lisankhu pakhar":              (27.9167, 85.7500),
    "shankharapur":                 (27.7500, 85.4500),
    "budhanilakantha":              (27.7939, 85.3611),
    "budhanilkantha":               (27.7939, 85.3611),
    "tarakeshwor":                  (27.7833, 85.2833),
    "tokha":                        (27.7611, 85.3194),
    "sunkoshi":                     (27.7500, 85.7833),
    "chautara sangachokgadhi":      (27.7833, 85.7000),
    "chautara sangachokgadhi municipality": (27.7833, 85.7000),
    # extras
    "kirtipur":                     (27.6767, 85.2792),
    "lalitpur":                     (27.6588, 85.3247),
    "bhaktapur":                    (27.6710, 85.4298),
    "dhulikhel":                    (27.6200, 85.5467),
    "melamchi":                     (27.8333, 85.5500),
    "nagarjun":                     (27.7500, 85.2667),
    "chandragiri":                  (27.6667, 85.2333),
}

DISTRICT_FALLBACK = {
    "kathmandu":     (27.7172, 85.3240),
    "sindhupalchok": (27.8333, 85.7000),
    "bhaktapur":     (27.6710, 85.4298),
    "lalitpur":      (27.6588, 85.3247),
    "kavrepalanchok":(27.6200, 85.5467),
    "nuwakot":       (27.9167, 85.1667),
    "rasuwa":        (28.0833, 85.3667),
    "dhading":       (27.8667, 84.9167),
    "makwanpur":     (27.4333, 85.0333),
}

WORLDCOVER_CLASSES = {
    10: "tree_cover", 20: "shrubland", 30: "grassland",
    40: "cropland",   50: "built_up",  60: "bare_sparse",
    70: "snow_ice",   80: "water",     90: "wetland",
    95: "mangrove",  100: "moss_lichen",
}
NDVI_PROXY = {
    "tree_cover": 0.75, "shrubland": 0.45, "grassland": 0.40,
    "cropland": 0.35,   "built_up": 0.10,  "bare_sparse": 0.05,
    "snow_ice": 0.00,   "water": 0.00,     "wetland": 0.50,
    "mangrove": 0.70,   "moss_lichen": 0.20, "unknown": 0.20,
}


def _load_basin_polygon():
    """
    Load basin polygon from GeoJSON.
    Returns shapely geometry in EPSG:4326 or None (fallback mode).
    """
    if not BASIN_BOUNDARY_GEOJSON.exists():
        print(f"[domain] WARNING: basin boundary not found at {BASIN_BOUNDARY_GEOJSON}")
        print("[domain] Falling back to BBOX filtering.")
        return None

    try:
        import geopandas as gpd

        gdf = gpd.read_file(BASIN_BOUNDARY_GEOJSON)
        if gdf.empty:
            print(f"[domain] WARNING: basin boundary file is empty: {BASIN_BOUNDARY_GEOJSON}")
            print("[domain] Falling back to BBOX filtering.")
            return None

        gdf = gdf.to_crs("EPSG:4326")
        poly = gdf.geometry.unary_union
        minx, miny, maxx, maxy = poly.bounds
        print(
            "[domain] loaded basin polygon "
            f"({len(gdf)} feature(s)) | bounds: "
            f"lon {minx:.4f}..{maxx:.4f}, lat {miny:.4f}..{maxy:.4f}"
        )
        return poly
    except Exception as exc:
        print(f"[domain] WARNING: failed to load basin polygon: {exc}")
        print("[domain] Falling back to BBOX filtering.")
        return None


def _points_in_domain_mask(
    lats: pd.Series,
    lons: pd.Series,
    basin_polygon=None,
) -> np.ndarray:
    if basin_polygon is None:
        return (
            (lats >= BBOX["min_lat"])
            & (lats <= BBOX["max_lat"])
            & (lons >= BBOX["min_lon"])
            & (lons <= BBOX["max_lon"])
        ).to_numpy()

    from shapely.geometry import Point

    mask = np.zeros(len(lats), dtype=bool)
    for i, (lat, lon) in enumerate(zip(lats.to_numpy(), lons.to_numpy())):
        if pd.isna(lat) or pd.isna(lon):
            continue
        mask[i] = bool(basin_polygon.covers(Point(float(lon), float(lat))))
    return mask


def _filter_points_to_domain(
    df: pd.DataFrame,
    basin_polygon=None,
    lat_col: str = "lat",
    lon_col: str = "lon",
    label: str = "records",
) -> pd.DataFrame:
    before = len(df)
    inside = _points_in_domain_mask(df[lat_col], df[lon_col], basin_polygon=basin_polygon)
    filtered = df.loc[inside].copy()
    dropped = before - len(filtered)

    mode = "BASIN_POLYGON" if basin_polygon is not None else "BBOX"
    if dropped > 0:
        print(f"         WARNING: dropping {dropped} {label} outside configured {mode}")
    return filtered


def _sample_points_in_domain(
    n_total: int,
    bbox: dict[str, float],
    rng: np.random.Generator,
    basin_polygon=None,
) -> tuple[np.ndarray, np.ndarray]:
    if basin_polygon is None:
        return (
            rng.uniform(bbox["min_lat"], bbox["max_lat"], n_total),
            rng.uniform(bbox["min_lon"], bbox["max_lon"], n_total),
        )

    from shapely.geometry import Point

    lats: list[float] = []
    lons: list[float] = []

    attempts = 0
    max_attempts = 80
    while len(lats) < n_total and attempts < max_attempts:
        need = n_total - len(lats)
        batch_n = max(need * 6, 512)
        cand_lat = rng.uniform(bbox["min_lat"], bbox["max_lat"], batch_n)
        cand_lon = rng.uniform(bbox["min_lon"], bbox["max_lon"], batch_n)

        for lat, lon in zip(cand_lat, cand_lon):
            if basin_polygon.covers(Point(float(lon), float(lat))):
                lats.append(float(lat))
                lons.append(float(lon))
                if len(lats) >= n_total:
                    break
        attempts += 1

    if len(lats) < n_total:
        missing = n_total - len(lats)
        print(
            "         WARNING: could not sample all points strictly inside basin polygon; "
            f"filling remaining {missing} with BBOX sampling"
        )
        extra_lat = rng.uniform(bbox["min_lat"], bbox["max_lat"], missing).tolist()
        extra_lon = rng.uniform(bbox["min_lon"], bbox["max_lon"], missing).tolist()
        lats.extend(extra_lat)
        lons.extend(extra_lon)

    return np.array(lats[:n_total], dtype=float), np.array(lons[:n_total], dtype=float)

def _sample_dates_stratified(
    rainfall: pd.DataFrame,
    bins: list[tuple[pd.Series, float]],
    n_total: int,
    random_state: int,
) -> np.ndarray:
    """Sample dates from multiple rainfall regimes to avoid trivial class separation."""
    sampled_parts: list[pd.Series] = []
    allocated = 0

    for i, (mask, weight) in enumerate(bins):
        n_bin = int(round(n_total * weight))
        if i == len(bins) - 1:
            n_bin = max(0, n_total - allocated)
        allocated += n_bin

        candidates = rainfall.loc[mask, "date"]
        if n_bin <= 0 or len(candidates) == 0:
            continue

        sampled_parts.append(
            candidates.sample(
                n=n_bin,
                replace=(len(candidates) < n_bin),
                random_state=random_state + i,
            )
        )

    if not sampled_parts:
        raise ValueError("No candidate dates available for stratified sampling.")

    sampled = pd.concat(sampled_parts, ignore_index=True)
    if len(sampled) < n_total:
        extra = rainfall["date"].sample(
            n=n_total - len(sampled),
            replace=(len(rainfall) < (n_total - len(sampled))),
            random_state=random_state + 99,
        )
        sampled = pd.concat([sampled, extra], ignore_index=True)
    return sampled.iloc[:n_total].to_numpy()


def _mixed_negative_coords(
    positives: pd.DataFrame,
    n_total: int,
    bbox: dict[str, float],
    random_state: int,
    basin_polygon=None,
    hard_ratio: float = 0.4,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Build negative coordinates with a mix of:
    - random basin-wide points
    - hard negatives jittered near positive locations
    """
    rng = np.random.default_rng(random_state)
    n_hard = int(round(n_total * hard_ratio))
    n_random = max(0, n_total - n_hard)

    lat_random, lon_random = _sample_points_in_domain(
        n_random,
        bbox,
        rng,
        basin_polygon=basin_polygon,
    )

    if n_hard > 0 and len(positives) > 0:
        sampled = positives.sample(n=n_hard, replace=(len(positives) < n_hard), random_state=random_state)
        lat_hard = sampled["lat"].to_numpy() + rng.normal(0, 0.03, size=n_hard)
        lon_hard = sampled["lon"].to_numpy() + rng.normal(0, 0.03, size=n_hard)
        lat_hard = np.clip(lat_hard, bbox["min_lat"], bbox["max_lat"])
        lon_hard = np.clip(lon_hard, bbox["min_lon"], bbox["max_lon"])

        hard_df = pd.DataFrame({"lat": lat_hard, "lon": lon_hard})
        hard_df = _filter_points_to_domain(
            hard_df,
            basin_polygon=basin_polygon,
            label="hard-negative jitter points",
        )
        keep_n = len(hard_df)
        if keep_n < n_hard:
            refill_lat, refill_lon = _sample_points_in_domain(
                n_hard - keep_n,
                bbox,
                rng,
                basin_polygon=basin_polygon,
            )
            lat_hard = np.concatenate([hard_df["lat"].to_numpy(), refill_lat])
            lon_hard = np.concatenate([hard_df["lon"].to_numpy(), refill_lon])
        else:
            lat_hard = hard_df["lat"].to_numpy()
            lon_hard = hard_df["lon"].to_numpy()
    else:
        lat_hard = np.array([], dtype=float)
        lon_hard = np.array([], dtype=float)

    lat = np.concatenate([lat_random, lat_hard])
    lon = np.concatenate([lon_random, lon_hard])
    return lat, lon


# ════════════════════════════════════════════════════════
# STEP 1 — BIPAD
# ════════════════════════════════════════════════════════

def geocode_row(row, muni_col, dist_col):
    # Try municipality name (cleaned)
    if muni_col and pd.notna(row.get(muni_col)):
        key = str(row[muni_col]).strip().lower()
        if key in MUNICIPALITY_COORDS:
            return MUNICIPALITY_COORDS[key]
        # Partial: first word match
        for k, v in MUNICIPALITY_COORDS.items():
            if key.split()[0] in k or k.split()[0] in key:
                return v

    # District fallback
    if dist_col and pd.notna(row.get(dist_col)):
        d = str(row[dist_col]).strip().lower()
        for k, v in DISTRICT_FALLBACK.items():
            if k in d:
                return v

    return (np.nan, np.nan)


def load_bipad(basin_polygon=None):
    print("\n[step 1] loading BIPAD incidents ...")
    dfs = []
    for csv in RAW_BIPAD.glob("*.csv"):
        df = pd.read_csv(csv, low_memory=False)
        dfs.append(df)
        print(f"         {csv.name}: {len(df)} rows")

    raw = pd.concat(dfs, ignore_index=True)
    raw.columns = raw.columns.str.strip().str.lower().str.replace(" ", "_")

    hazard_col = "hazard"
    date_col   = "incident_on"
    dist_col   = "district"
    muni_col   = "municipality"

    raw[hazard_col] = raw[hazard_col].str.strip().str.lower()
    events = raw[raw[hazard_col].isin(["flood", "landslide"])].copy()

    # Parse dates — format is YYYY-MM-DD (AD) confirmed from your output
    events["date"] = pd.to_datetime(events[date_col], errors="coerce")
    events = events.dropna(subset=["date"])
    events["date"] = events["date"].dt.normalize()

    # Filter monsoon months only
    events = events[events["date"].dt.month.isin(GPM_MONTHS)]

    # Filter Bagmati districts
    events[dist_col] = events[dist_col].str.strip().str.lower()
    events = events[events[dist_col].str.contains(
        "|".join(BAGMATI_DISTRICTS), na=False
    )]

    # Geocode
    coords = events.apply(lambda r: geocode_row(r, muni_col, dist_col), axis=1)
    events["lat"] = [c[0] for c in coords]
    events["lon"] = [c[1] for c in coords]

    # Report unmatched
    unmatched = events[events["lat"].isna()]["municipality"].unique()
    if len(unmatched):
        print(f"         WARNING: could not geocode: {unmatched}")

    events = events.dropna(subset=["lat", "lon"])

    # Keep only events inside configured domain (basin polygon preferred; BBOX fallback).
    events = _filter_points_to_domain(
        events,
        basin_polygon=basin_polygon,
        label="events",
    )

    events = events[["date", "lat", "lon", hazard_col]].copy()
    events.columns = ["date", "lat", "lon", "hazard"]

    # Remove exact duplicate events to reduce leakage/memorization
    before = len(events)
    events = events.drop_duplicates(subset=["date", "lat", "lon", "hazard"]).copy()
    removed = before - len(events)
    if removed > 0:
        print(f"         removed duplicate events: {removed}")

    floods     = events[events["hazard"] == "flood"].copy()
    landslides = events[events["hazard"] == "landslide"].copy()

    print(f"         date range in BIPAD: {events['date'].min().date()} → {events['date'].max().date()}")
    print(f"         flood events:     {len(floods)}")
    print(f"         landslide events: {len(landslides)}")
    return floods, landslides


# ════════════════════════════════════════════════════════
# STEP 2 — Rainfall (aggregate 30-min → daily)
# ════════════════════════════════════════════════════════

def load_rainfall():
    print("\n[step 2] loading GPM rainfall ...")
    csv_path = RAW_RAINFALL / "gpm_bagmati_daily.csv"
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    # Parse date — handles both "2015-05-01" and "20150501000000"
    date_col = next((c for c in df.columns if c == "date"), None)
    df["date"] = pd.to_datetime(df[date_col], errors="coerce").dt.normalize()

    rain_col = next(
        (c for c in df.columns if any(x in c for x in ["rain", "precip", "precipitation"])),
        None
    )
    df["rainfall_mm"] = pd.to_numeric(df[rain_col], errors="coerce").fillna(0)

    # KEY FIX: aggregate multiple rows per day → sum (30-min → daily total)
    daily = (
        df.groupby("date")["rainfall_mm"]
        .sum()
        .reset_index()
    )
    daily = daily.sort_values("date")

    # Rolling windows
    daily["rf_1day"]  = daily["rainfall_mm"]
    daily["rf_3day"]  = daily["rainfall_mm"].rolling(3,  min_periods=1).sum()
    daily["rf_7day"]  = daily["rainfall_mm"].rolling(7,  min_periods=1).sum()
    daily["rf_30day"] = daily["rainfall_mm"].rolling(30, min_periods=1).sum()

    result = daily[["date", "rf_1day", "rf_3day", "rf_7day", "rf_30day"]].copy()
    print(f"         rows after daily aggregation: {len(result)}")
    print(f"         date range: {result['date'].min().date()} → {result['date'].max().date()}")
    print(f"         max daily rainfall: {result['rf_1day'].max():.1f} mm")
    return result


# ════════════════════════════════════════════════════════
# STEP 3 — Discharge
# ════════════════════════════════════════════════════════

def load_discharge():
    print("\n[step 3] loading ERA5 discharge ...")
    csv_path = RAW_DISCHARGE / "glofas_bagmati_daily.csv"
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip().str.lower()

    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.normalize()

    runoff_col = next(
        (c for c in df.columns if any(x in c for x in ["runoff", "discharge"])),
        None
    )
    if runoff_col is None:
        # use surface + subsurface runoff
        surf = "surface_runoff_sum"
        sub  = "sub_surface_runoff_sum"
        if surf in df.columns and sub in df.columns:
            df["runoff_total"] = (
                pd.to_numeric(df[surf], errors="coerce").fillna(0) +
                pd.to_numeric(df[sub],  errors="coerce").fillna(0)
            )
            runoff_col = "runoff_total"
        else:
            num_cols = df.select_dtypes(include=np.number).columns.tolist()
            df["runoff_total"] = df[num_cols].mean(axis=1)
            runoff_col = "runoff_total"

    # Soil moisture index from ERA5-Land volumetric soil-water layers.
    # Typical range is about 0..1 m3/m3 depending on soil layer.
    sm_cols = [
        "volumetric_soil_water_layer_1",
        "volumetric_soil_water_layer_2",
        "volumetric_soil_water_layer_3",
        "volumetric_soil_water_layer_4",
    ]
    present_sm_cols = [c for c in sm_cols if c in df.columns]

    if present_sm_cols:
        df["soil_moisture_index"] = (
            df[present_sm_cols]
            .apply(pd.to_numeric, errors="coerce")
            .mean(axis=1)
        )
    else:
        # Backward-compatible fallback for previously exported CSVs.
        # Uses normalized 7-day rainfall proxy when soil-moisture layers are absent.
        print("         WARNING: soil moisture bands not found in discharge CSV; using proxy index")
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
    )
    # Scale runoff (m/day) → m³/s for Bagmati basin (~3500 km²)
    daily["discharge_proxy"] = (
        pd.to_numeric(daily["discharge_proxy"], errors="coerce").fillna(0)
        * 3.5e9 / 86400
    ).clip(lower=0)

    print(f"         date range: {daily['date'].min().date()} → {daily['date'].max().date()}")
    print(f"         discharge range: {daily['discharge_proxy'].min():.1f} – {daily['discharge_proxy'].max():.1f} m³/s")
    print(f"         soil moisture index range: {daily['soil_moisture_index'].min():.3f} – {daily['soil_moisture_index'].max():.3f}")
    return daily


# ════════════════════════════════════════════════════════
# STEP 3b — Sentinel-1 SAR
# ════════════════════════════════════════════════════════

def load_sar(rainfall_dates: pd.Series):
    print("\n[step 3b] loading Sentinel-1 SAR ...")
    csv_path = RAW_SENTINEL / "sentinel1_bagmati_daily.csv"

    if not csv_path.exists():
        print("         WARNING: SAR CSV not found; using neutral fallback values")
        base = pd.DataFrame({"date": pd.to_datetime(rainfall_dates).dt.normalize().drop_duplicates()})
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
    ratio_col = "sar_vv_vh_ratio_db" if "sar_vv_vh_ratio_db" in df.columns else None

    if vv_col is None or vh_col is None:
        raise ValueError("SAR CSV missing VV/VH columns. Expected sar_vv_db and sar_vh_db.")

    df["sar_vv_db"] = pd.to_numeric(df[vv_col], errors="coerce")
    df["sar_vh_db"] = pd.to_numeric(df[vh_col], errors="coerce")
    if ratio_col and ratio_col in df.columns:
        df["sar_vv_vh_ratio_db"] = pd.to_numeric(df[ratio_col], errors="coerce")
    else:
        df["sar_vv_vh_ratio_db"] = df["sar_vv_db"] - df["sar_vh_db"]

    daily = (
        df.groupby("date")[["sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db"]]
        .mean()
        .reset_index()
        .sort_values("date")
    )

    # Align to rainfall date index so every training date has SAR features.
    aligned = pd.DataFrame({"date": pd.to_datetime(rainfall_dates).dt.normalize().drop_duplicates()})
    aligned = aligned.merge(daily, on="date", how="left").sort_values("date")
    for c in ["sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db"]:
        aligned[c] = aligned[c].interpolate(method="linear").ffill().bfill()

    print(f"         raw SAR rows: {len(df)}, daily rows: {len(daily)}")
    print(f"         aligned dates: {aligned['date'].min().date()} → {aligned['date'].max().date()}")
    print(
        "         SAR range: "
        f"VV {aligned['sar_vv_db'].min():.2f}..{aligned['sar_vv_db'].max():.2f} dB, "
        f"VH {aligned['sar_vh_db'].min():.2f}..{aligned['sar_vh_db'].max():.2f} dB"
    )
    return aligned


# ════════════════════════════════════════════════════════
# STEP 4 — Terrain
# ════════════════════════════════════════════════════════

def extract_terrain_at_points(lats, lons):
    import rasterio
    from rasterio.transform import rowcol

    tif = next(
        (f for f in list(RAW_DEM.glob("*.tif")) + list(RAW_DEM.glob("*.hgt"))),
        None
    )
    if tif is None:
        raise FileNotFoundError("No DEM file in data/raw/dem/")

    print(f"\n[step 4] extracting terrain from {tif.name} for {len(lats)} points ...")

    with rasterio.open(tif) as src:
        dem = src.read(1).astype(float)
        nodata = src.nodata or -9999
        dem[dem == nodata] = np.nan

        px = abs(src.transform.a)
        res_m = px if px > 1 else px * 111320

        dy, dx       = np.gradient(dem, res_m)
        slope_arr    = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2)))
        aspect_arr   = np.degrees(np.arctan2(-dx, dy)) % 360
        curv_arr     = np.gradient(dy, res_m)[0] + np.gradient(dx, res_m)[1]

        rows_out = []
        for lat, lon in zip(lats, lons):
            try:
                r, c = rowcol(src.transform, lon, lat)
                r = int(np.clip(r, 0, dem.shape[0] - 1))
                c = int(np.clip(c, 0, dem.shape[1] - 1))
                rows_out.append({
                    "elevation_m": float(dem[r, c])      if not np.isnan(dem[r, c]) else np.nan,
                    "slope_deg":   float(slope_arr[r, c]),
                    "aspect_deg":  float(aspect_arr[r, c]),
                    "curvature":   float(curv_arr[r, c]),
                })
            except Exception:
                rows_out.append({"elevation_m": np.nan, "slope_deg": 0.0,
                                  "aspect_deg": 0.0, "curvature": 0.0})

    df = pd.DataFrame(rows_out)
    print(f"         elevation: {df['elevation_m'].min():.0f}–{df['elevation_m'].max():.0f} m  |  slope: {df['slope_deg'].min():.1f}–{df['slope_deg'].max():.1f}°")
    return df


# ════════════════════════════════════════════════════════
# STEP 5 — Land use
# ════════════════════════════════════════════════════════

def extract_landuse_at_points(lats, lons):
    import rasterio
    from rasterio.transform import rowcol

    tif = next((f for f in RAW_LANDUSE.glob("*.tif")), None)
    if tif is None:
        raise FileNotFoundError("No WorldCover tif in data/raw/landuse/")

    print(f"\n[step 5] extracting land use from {tif.name} ...")

    rows_out = []
    with rasterio.open(tif) as src:
        lc = src.read(1)
        for lat, lon in zip(lats, lons):
            try:
                r, c = rowcol(src.transform, lon, lat)
                r = int(np.clip(r, 0, lc.shape[0] - 1))
                c = int(np.clip(c, 0, lc.shape[1] - 1))
                code = int(lc[r, c])
                name = WORLDCOVER_CLASSES.get(code, "unknown")
            except Exception:
                code, name = -1, "unknown"
            rows_out.append({
                "landuse_code":  code,
                "landuse_class": name,
                "ndvi_proxy":    NDVI_PROXY.get(name, 0.20),
            })

    return pd.DataFrame(rows_out)


# ════════════════════════════════════════════════════════
# STEP 6a — Flood training table
# ════════════════════════════════════════════════════════

def build_flood_training(floods, rainfall, discharge, sar, basin_polygon=None):
    print("\n[step 6a] building flood training table ...")
    print(f"         rainfall date range: {rainfall['date'].min().date()} → {rainfall['date'].max().date()}")
    print(f"         BIPAD flood dates:   {floods['date'].min().date()} → {floods['date'].max().date()}")

    pos = floods[["date", "lat", "lon"]].copy()
    pos["label"] = 1

    # Target a moderate imbalance (~2:1 negatives) to avoid extreme skew
    n_neg    = max(int(len(pos) * 2), 300)

    # Harder negative regime sampling:
    # include low, moderate, and heavy-rain dates so the model cannot solve by a single threshold.
    neg_dates = _sample_dates_stratified(
        rainfall,
        bins=[
            (rainfall["rf_1day"] < 5.0, 0.45),
            ((rainfall["rf_1day"] >= 5.0) & (rainfall["rf_1day"] < 25.0), 0.35),
            (rainfall["rf_1day"] >= 25.0, 0.20),
        ],
        n_total=n_neg,
        random_state=42,
    )
    neg_lat, neg_lon = _mixed_negative_coords(
        pos,
        n_neg,
        BBOX,
        random_state=42,
        basin_polygon=basin_polygon,
        hard_ratio=0.45,
    )

    neg = pd.DataFrame({
        "date":  neg_dates,
        "lat":   neg_lat,
        "lon":   neg_lon,
        "label": 0,
    })
    neg["date"] = pd.to_datetime(neg["date"]).dt.normalize()
    neg = _filter_points_to_domain(
        neg,
        basin_polygon=basin_polygon,
        label="flood negatives",
    )

    if len(neg) < n_neg:
        refill_n = n_neg - len(neg)
        refill_dates = rainfall["date"].sample(
            n=refill_n,
            replace=(len(rainfall) < refill_n),
            random_state=4200,
        ).to_numpy()
        refill_rng = np.random.default_rng(4200)
        refill_lat, refill_lon = _sample_points_in_domain(
            refill_n,
            BBOX,
            refill_rng,
            basin_polygon=basin_polygon,
        )
        refill = pd.DataFrame({
            "date": refill_dates,
            "lat": refill_lat,
            "lon": refill_lon,
            "label": 0,
        })
        refill["date"] = pd.to_datetime(refill["date"]).dt.normalize()
        neg = pd.concat([neg, refill], ignore_index=True)

    combined = pd.concat([pos, neg], ignore_index=True)
    combined["date"] = pd.to_datetime(combined["date"]).dt.normalize()

    # Join
    combined = combined.merge(rainfall,  on="date", how="left")
    combined = combined.merge(discharge, on="date", how="left")
    combined = combined.merge(sar,       on="date", how="left")

    terrain = extract_terrain_at_points(combined["lat"].tolist(), combined["lon"].tolist())
    combined = pd.concat([combined.reset_index(drop=True), terrain], axis=1)

    combined["month"]       = combined["date"].dt.month
    combined["day_of_year"] = combined["date"].dt.dayofyear
    combined = combined.dropna(subset=["rf_1day", "elevation_m", "sar_vv_db", "sar_vh_db"])

    before = len(combined)
    combined = combined.drop_duplicates(subset=["date", "lat", "lon", "label"]).copy()
    removed = before - len(combined)
    if removed > 0:
        print(f"         removed duplicate rows: {removed}")

    print(f"         positive (flood):     {int(combined['label'].sum())}")
    print(f"         negative (non-flood): {int((combined['label'] == 0).sum())}")
    print(f"         total rows:           {len(combined)}")
    return combined


# ════════════════════════════════════════════════════════
# STEP 6b — Landslide training table
# ════════════════════════════════════════════════════════

def build_landslide_training(landslides, rainfall, basin_polygon=None):
    print("\n[step 6b] building landslide training table ...")
    print(f"         rainfall date range:    {rainfall['date'].min().date()} → {rainfall['date'].max().date()}")
    print(f"         BIPAD landslide dates:  {landslides['date'].min().date()} → {landslides['date'].max().date()}")

    pos = landslides[["date", "lat", "lon"]].copy()
    pos["label"] = 1

    # Keep negatives near parity with positives for more stable training
    n_neg    = max(int(len(pos) * 1.2), 400)
    neg_dates = _sample_dates_stratified(
        rainfall,
        bins=[
            (rainfall["rf_3day"] < 10.0, 0.35),
            ((rainfall["rf_3day"] >= 10.0) & (rainfall["rf_3day"] < 50.0), 0.40),
            (rainfall["rf_3day"] >= 50.0, 0.25),
        ],
        n_total=n_neg,
        random_state=123,
    )
    neg_lat, neg_lon = _mixed_negative_coords(
        pos,
        n_neg,
        BBOX,
        random_state=123,
        basin_polygon=basin_polygon,
        hard_ratio=0.50,
    )

    neg = pd.DataFrame({
        "date":  neg_dates,
        "lat":   neg_lat,
        "lon":   neg_lon,
        "label": 0,
    })
    neg["date"] = pd.to_datetime(neg["date"]).dt.normalize()
    neg = _filter_points_to_domain(
        neg,
        basin_polygon=basin_polygon,
        label="landslide negatives",
    )

    if len(neg) < n_neg:
        refill_n = n_neg - len(neg)
        refill_dates = rainfall["date"].sample(
            n=refill_n,
            replace=(len(rainfall) < refill_n),
            random_state=12300,
        ).to_numpy()
        refill_rng = np.random.default_rng(12300)
        refill_lat, refill_lon = _sample_points_in_domain(
            refill_n,
            BBOX,
            refill_rng,
            basin_polygon=basin_polygon,
        )
        refill = pd.DataFrame({
            "date": refill_dates,
            "lat": refill_lat,
            "lon": refill_lon,
            "label": 0,
        })
        refill["date"] = pd.to_datetime(refill["date"]).dt.normalize()
        neg = pd.concat([neg, refill], ignore_index=True)

    combined = pd.concat([pos, neg], ignore_index=True)
    combined["date"] = pd.to_datetime(combined["date"]).dt.normalize()
    combined = combined.merge(rainfall, on="date", how="left")

    terrain = extract_terrain_at_points(combined["lat"].tolist(), combined["lon"].tolist())
    combined = pd.concat([combined.reset_index(drop=True), terrain], axis=1)

    landuse = extract_landuse_at_points(combined["lat"].tolist(), combined["lon"].tolist())
    combined = pd.concat([combined.reset_index(drop=True), landuse], axis=1)

    station_coords = np.array([[s["lat"], s["lon"]] for s in STATIONS])
    def min_dist(row):
        diffs = station_coords - np.array([row["lat"], row["lon"]])
        return np.sqrt((diffs**2).sum(axis=1)).min() * 111320
    combined["dist_drainage_m"] = combined.apply(min_dist, axis=1)

    combined["month"]       = pd.to_datetime(combined["date"]).dt.month
    combined["day_of_year"] = pd.to_datetime(combined["date"]).dt.dayofyear
    combined = combined.dropna(subset=["slope_deg", "rf_1day"])

    before = len(combined)
    combined = combined.drop_duplicates(subset=["date", "lat", "lon", "label"]).copy()
    removed = before - len(combined)
    if removed > 0:
        print(f"         removed duplicate rows: {removed}")

    print(f"         positive (landslide): {int(combined['label'].sum())}")
    print(f"         negative (non-event): {int((combined['label'] == 0).sum())}")
    print(f"         total rows:           {len(combined)}")
    return combined


# ════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  BAHURAKSHA — preprocessing pipeline (fixed)")
    print("=" * 60)

    DATA_TRAINING.mkdir(parents=True, exist_ok=True)
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)

    basin_polygon      = _load_basin_polygon()
    floods, landslides = load_bipad(basin_polygon=basin_polygon)
    rainfall           = load_rainfall()
    discharge          = load_discharge()
    sar                = load_sar(rainfall["date"])

    # Guardrail: do not build training files with zero-overlap timelines.
    meteo_start = min(rainfall["date"].min(), discharge["date"].min())
    meteo_end   = max(rainfall["date"].max(), discharge["date"].max())

    flood_overlap = floods[(floods["date"] >= meteo_start) & (floods["date"] <= meteo_end)]
    ls_overlap    = landslides[(landslides["date"] >= meteo_start) & (landslides["date"] <= meteo_end)]

    if len(flood_overlap) == 0 or len(ls_overlap) == 0:
        print("\n[error] zero label overlap between BIPAD events and meteo data.")
        print(f"        meteo range:    {meteo_start.date()} -> {meteo_end.date()}")
        print(f"        flood labels:   {floods['date'].min().date()} -> {floods['date'].max().date()} (overlap: {len(flood_overlap)})")
        print(f"        landslide lbls: {landslides['date'].min().date()} -> {landslides['date'].max().date()} (overlap: {len(ls_overlap)})")
        print("\n        Action:")
        print("        1) Extend GPM/GLOFAS end year in config.py to include label years (e.g., 2025)")
        print("        2) Re-run scripts/02_download_rainfall.py and scripts/03_download_discharge.py")
        print("        3) Re-run this preprocess script")
        sys.exit(1)

    flood_df = build_flood_training(
        floods,
        rainfall,
        discharge,
        sar,
        basin_polygon=basin_polygon,
    )
    flood_out = DATA_TRAINING / "flood_training.csv"
    flood_df.to_csv(flood_out, index=False)
    print(f"\n[saved] {flood_out}")

    landslide_df = build_landslide_training(
        landslides,
        rainfall,
        basin_polygon=basin_polygon,
    )
    ls_out = DATA_TRAINING / "landslide_training.csv"
    landslide_df.to_csv(ls_out, index=False)
    print(f"[saved] {ls_out}")

    print("\n" + "=" * 60)
    print("  Preprocessing complete.")
    print(f"  flood_training.csv:     {len(flood_df)} rows, {int(flood_df['label'].sum())} positive")
    print(f"  landslide_training.csv: {len(landslide_df)} rows, {int(landslide_df['label'].sum())} positive")
    print("  Next: python scripts/06_train_models.py")
    print("=" * 60)

if __name__ == "__main__":
    main()
