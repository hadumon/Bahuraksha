from pathlib import Path

ROOT = Path(__file__).resolve().parent

MODELS_DIR = ROOT / "models"
RAW_RAINFALL = ROOT / "data" / "raw" / "rainfall"
RAW_DISCHARGE = ROOT / "data" / "raw" / "discharge"
RAW_SENTINEL = ROOT / "data" / "raw" / "sentinel"
RAW_DEM = ROOT / "data" / "raw" / "dem"
RAW_LANDUSE = ROOT / "data" / "raw" / "landuse"

# ─── Bagmati Basin bounding box ──────────────────────────────────────────────
# Covers Kathmandu Valley + Sindhupalchok upper catchment
# Format: (min_lon, min_lat, max_lon, max_lat)
BBOX = {
    "min_lon":  85.20,
    "min_lat":  27.45,
    "max_lon":  85.65,
    "max_lat":  27.95,
}

# Shorthand lists used by different APIs
BBOX_LIST   = [BBOX["min_lon"], BBOX["min_lat"], BBOX["max_lon"], BBOX["max_lat"]]
BBOX_XARRAY = [BBOX["min_lat"], BBOX["max_lat"], BBOX["min_lon"], BBOX["max_lon"]]

# ─── Target CRS and resolution ───────────────────────────────────────────────
TARGET_CRS        = "EPSG:32645"   # UTM Zone 45N — correct for Nepal
TARGET_RESOLUTION = 30             # metres — matches SRTM

# ─── Rainfall download parameters ────────────────────────────────────────────
GPM_START_YEAR = 2015
GPM_END_YEAR   = 2025
GPM_MONTHS     = [5, 6, 7, 8, 9, 10]   # May–Oct covers full Nepal monsoon season

# ─── GloFAS download parameters ──────────────────────────────────────────────
GLOFAS_START_YEAR = 2015
GLOFAS_END_YEAR   = 2025

# ─── Sentinel-1 SAR parameters ───────────────────────────────────────────────
SAR_START_YEAR = 2015
SAR_END_YEAR   = 2025

# ─── River stations (from your HEC-RAS CSV) ──────────────────────────────────
STATIONS = [
    {"id": "st-2", "name": "Sundarijal", "lat": 27.7700, "lon": 85.4200, "river_km": 20.4, "warning_m": 3.8, "danger_m": 4.5},
    {"id": "st-3", "name": "Gokarna",    "lat": 27.7300, "lon": 85.3700, "river_km": 15.8, "warning_m": 4.8, "danger_m": 5.5},
    {"id": "st-5", "name": "Pashupati",  "lat": 27.7100, "lon": 85.3500, "river_km": 10.9, "warning_m": 4.8, "danger_m": 5.5},
    {"id": "st-4", "name": "Teku",       "lat": 27.6950, "lon": 85.3050, "river_km":  5.4, "warning_m": 4.8, "danger_m": 5.5},
    {"id": "st-1", "name": "Chovar",     "lat": 27.6600, "lon": 85.2900, "river_km":  0.8, "warning_m": 4.8, "danger_m": 5.5},
]

# ─── WorldCover tile URL for Nepal (N27E085) ─────────────────────────────────
WORLDCOVER_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com"
    "/v200/2021/map/ESA_WorldCover_10m_2021_v200_N27E085_Map.tif"
)
