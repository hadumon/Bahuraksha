# Bahuraksha Project Documentation

## 1. Project Overview

Bahuraksha is a comprehensive flood and landslide risk monitoring and early warning dashboard designed specifically for Nepal. The system consists of:

1. **Web Dashboard**: React-based web application with interactive maps, risk zone visualization, river monitoring, and landslide prediction UI.
2. **Early Warning API** (`bahuraksha-api`): FastAPI backend with trained XGBoost models for flood and landslide prediction, satellite data ingestion, and live risk zone endpoints.
3. **ML Pipeline** (`ml-pipeline`): XGBoost-based landslide susceptibility model trained on ICIMOD real inventory data + synthetic augmentation.

Data sources (all free, no API key required):
- **NASA POWER**: 10 years of daily rainfall data (2016–2026)
- **USGS Earthquakes**: Real-time seismic activity monitoring
- **Open-Meteo**: 7-day rainfall forecasts and flood API
- **Microsoft Planetary Computer**: Sentinel-1 RTC and Sentinel-2 L2A satellite scenes
- **ICIMOD**: 50 real landslide event records from Nepal

---

## 2. Technology Stack

### Frontend & Web Application
- **Framework**: React 19 with TypeScript, built using Vite.
- **Styling**: Tailwind CSS v4 with shadcn/ui components (new-york style).
- **State & Routing**: React Router for navigation, TanStack Query for data fetching (5min stale time, retry: 2).
- **Mapping**: React Leaflet for interactive 2D maps (`RiskMap.tsx` for flood, `LandslideMap.tsx` for landslide ML).
- **Animation**: Framer Motion for page transitions.
- **Testing**: Vitest (jsdom) for unit tests, Playwright for E2E.

### Backend & Database
- **Database**: PostgreSQL hosted on Supabase.
- **Authentication**: Supabase Auth via custom `AuthProvider` + `ProtectedRoute`. Auth removed from `/risk-map`, `/monitoring`, `/landslides` (public).
- **Data layer**: All Supabase queries in `src/lib/operationalData.ts` with empty-array fallbacks.
- **Permissions**: RBAC with 5 roles (`admin`, `ops`, `analyst`, `field`, `viewer`) in `src/lib/permissions.ts`.

### ML Backends

#### bahuraksha-api (Flood + Landslide)
- **Framework**: FastAPI (Python 3.11).
- **Geospatial**: rasterio for DEM/landuse processing.
- **ML**: XGBoost classifiers for flood and landslide probability.
- **Data pipeline**: CSV-based feature loading from 10 years of NASA POWER rainfall, estimated discharge, and Sentinel SAR.
- **Rate limiting**: slowapi (default 30/min, configurable via `BAHURAKSHA_RATE_LIMIT`).
- **Cache**: In-memory TTL cache on `/risk/zones/live` (default 300s).
- **Deploy**: Render (port 10000, Python native — not Docker).

#### ml-pipeline (Landslide Susceptibility)
- **ML**: XGBoost + isotonic calibration, 20 features (14 raw + 6 engineered interactions).
- **Training data**: 50 real ICIMOD positives + 5,500 synthetic samples (augment-real mode).
- **CV performance**: ROC-AUC 0.875, Avg Precision 0.561, F1 0.532.
- **Deploy**: Docker (port 8000, `docker compose up`).

---

## 3. Data Pipeline

### 3.1. Real Data Ingestion

All data is fetched from free public APIs with no registration required.

| Script | Source | Data | Format |
|---|---|---|---|
| `ingest-real-csv-data.py` | NASA POWER | 10 years daily rainfall (12 Bagmati grid points) | CSV |
| `ingest-real-csv-data.py` | NASA POWER → hydrological model | Estimated river discharge (linear reservoir + baseflow) | CSV |
| `import-real-risk-zones.py` | Nepal geography (hardcoded) | 54 districts/municipalities with lat/lon, population, elevation | Supabase `risk_zones` |
| `import-real-landslide-data.py` | NASA POWER + USGS | Per-zone rainfall + seismic → heuristic risk score (weighted formula) | Supabase `landslide_predictions` |
| `ingest:rainfall` (npm) | Open-Meteo | 7-day rainfall forecast for Bagmati Basin | Supabase `rainfall_forecasts` |
| `ingest:river-levels` (npm) | Open-Meteo Flood API | River discharge → level conversion for 5 stations | Supabase `river_level_observations` |
| `ingest:satellite` (npm) | Planetary Computer | Sentinel-1 RTC + Sentinel-2 L2A scene metadata | Supabase `sentinel_scenes` |
| `ingest:flood-predictions` (npm) | Render API | Flood probability for 6 Kathmandu Valley zones | Supabase `flood_predictions` |

### 3.2. Risk Zone Geography

54 zones organized as:
- **38 administrative districts** across all 7 provinces (Terai, Bagmati, Gandaki, Lumbini, Karnali, Sudurpashchim, Province No. 1)
- **13 Kathmandu Valley municipalities** (Metropolitan + Municipality level)
- **3 district-level Kathmandu Valley zones** (Kathmandu, Lalitpur, Bhaktapur districts)

Each zone has: `name`, `district`, `center_lat`, `center_lng`, `population`, `risk_level`, `flood_probability`, `landslide_probability`, `source`.

### 3.3. Landslide Prediction Engine

Two parallel systems generate landslide predictions:

#### Heuristic (primary, in production)
`import-real-landslide-data.py` computes risk from real environmental factors:

| Factor | Weight | Normalization |
|---|---|---|
| 7-day rainfall | 40% | 0–200mm → 0–1 |
| Today's rainfall | 25% | 0–50mm → 0–1 |
| Seismic activity | 15% | 0–5 magnitude, nonlinear |
| Slope | 10% | 0–40 degrees → 0–1 |
| NDVI (vegetation inverse) | 10% | 0–1 → 1–0 |

Thresholds: evacuate ≥0.78, warning ≥0.58, watch ≥0.32, safe <0.32.

#### ML Model (trained, ready for monsoon)
`generate-landslide-predictions.py` uses the retrained XGBoost model:
- Trained on 50 real ICIMOD positives + 5,500 synthetic samples
- 14 raw features + 6 engineered interactions = 20 total
- Isotonic calibration produces conservative probabilities
- Currently all predictions 0.0 during dry season — expects monsoon rainfall to cross decision boundary
- When active, uses same thresholds: evacuate ≥0.78, warning ≥0.58, watch ≥0.32

### 3.4. Flood Prediction

Two flood models:
1. **bahuraksha-api**: XGBoost trained on 3,650 days of real NASA POWER rainfall + estimated discharge + Sentinel SAR. Labels generated from physical thresholds (rainfall percentiles + discharge). **CV ROC-AUC 0.885**, Test F1 0.800.
2. **Render API** (`bahuraksha.onrender.com`): External service, results stored in `flood_predictions` table. Falls back to safe predictions on timeout.

### 3.5. River Monitoring

5 stations along the Bagmati River corridor:
| Station | Location | Warning Level | Danger Level |
|---|---|---|---|
| Sundarijal | 27.77N, 85.42E | 3.8m | 4.5m |
| Gokarna | 27.73N, 85.37E | 4.8m | 5.5m |
| Pashupati | 27.71N, 85.35E | 4.8m | 5.5m |
| Teku | 27.695N, 85.305E | 4.8m | 5.5m |
| Chovar | 27.66N, 85.29E | 4.8m | 5.5m |

Current levels fetched from Open-Meteo Flood API. Discharge converted to stage using Manning's equation.

---

## 4. Model Training

### bahuraksha-api Flood Model (`train_flood_model.py`)
- **Training data**: 3,650 days (2016–2026), 17.3% positive rate (synthetic labels)
- **Split**: train ≤2022 (2,404 rows), val 2023-2024 (731), test ≥2025 (515)
- **Algorithm**: XGBoost (150 trees, max_depth 5, learning_rate 0.05)
- **Metrics**: Test ROC-AUC **0.836**, F1 **0.800**, Precision **0.909**, Recall **0.714**
- **CV**: ROC-AUC **0.885**, PR-AUC **0.817**
- **Threshold**: 0.610 (F1-optimized on validation)

### bahuraksha-api Landslide Model (`train_landslide_model.py`)
- **Training data**: 21,900 zone-days (6 zones × 3,650 days), 16.2% positive rate
- **Split**: train ≤2022 (14,424), val 2023-2024 (4,386), test ≥2025 (3,090)
- **Algorithm**: XGBoost (same hyperparameters)
- **Metrics**: Test ROC-AUC **0.905**, F1 **0.886**, Precision **0.970**, Recall **0.815**
- **CV**: ROC-AUC **0.919**, PR-AUC **0.862**
- **Threshold**: 0.470 (F1-optimized on validation)

### ml-pipeline Landslide Model (`train.py`)
- **Training data**: 50 real ICIMOD positives + 5,500 synthetic (augment-real, 10:1 ratio)
- **Algorithm**: XGBoost + isotonic calibration
- **Features**: 14 raw (slope, rainfall, seismic, elevation, etc.) + 6 engineered interactions
- **CV**: ROC-AUC **0.875**, F1 **0.532**, Precision **0.477**, Recall **0.603**
- **Thresholds**: evacuate ≥0.78, warning ≥0.58, watch ≥0.32

---

## 5. Architecture Flow

```
NASA POWER ──→ ingest-real-csv-data.py ──→ CSVs ──→ train_flood_model.py ──→ models/flood_model.pkl
USGS      ──→ import-real-landslide-data.py ──→ Supabase landslide_predictions (heuristic)
Open-Meteo ──→ npm run ingest:rainfall     ──→ Supabase rainfall_forecasts
Planetary  ──→ npm run ingest:satellite    ──→ Supabase sentinel_scenes
ICIMOD     ──→ ml-pipeline/train.py        ──→ models/landslide_model.joblib

Frontend:
  App.tsx → React Router → Pages
    ├── RiskMap.tsx        → Leaflet + risk_zones (heatmap)
    ├── LandslideMap.tsx   → Leaflet + landslide_predictions
    ├── RiverMonitoring.tsx → river_stations + observations
    └── Dashboard.tsx      → aggregated risk overview
```

---

## 6. Directory Structure

```
/
├── src/                    # React web application
│   ├── components/         # UI + map components (shadcn/ui, React Leaflet)
│   ├── lib/                # Utilities, API clients, permissions
│   ├── pages/              # Route page components
│   └── integrations/       # Supabase client
├── bahuraksha-api/         # FastAPI backend (flood + landslide)
│   ├── main.py             # API endpoints + routing
│   ├── csv_models.py       # CSV data loading + feature engineering
│   ├── train_flood_model.py
│   ├── train_landslide_model.py
│   ├── models/             # Trained model artifacts (.pkl)
│   └── data/raw/           # 10-year rainfall, discharge, SAR CSVs
├── ml-pipeline/            # Landslide ML pipeline
│   ├── train.py            # Training with CV + calibration
│   ├── feature_engineering.py  # Domain-specific feature transforms
│   ├── data_pipeline.py    # Synthetic data generation + real data loading
│   ├── api_server.py       # FastAPI prediction server
│   └── models/             # Trained model artifacts (.joblib)
├── scripts/                # Data ingestion + utility scripts
│   ├── ingest-real-csv-data.py
│   ├── import-real-risk-zones.py
│   ├── import-real-landslide-data.py
│   └── generate-landslide-predictions.py
├── supabase/migrations/    # SQL schema migrations
│   └── 20260531180000_make_public_pages_rls.sql  # Public SELECT RLS
├── docs/                   # Documentation
└── tests/                  # Playwright E2E tests
```
