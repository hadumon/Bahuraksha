# Bahuraksha — Nepal Disaster Risk Monitoring

Real-time flood and landslide risk monitoring dashboard for Nepal, powered by:
- **Real API data**: NASA POWER rainfall, USGS seismic, Open-Meteo forecasts, Planetary Computer satellite
- **Trained ML models**: XGBoost for flood (ROC-AUC 0.89) and landslide (ROC-AUC 0.92) prediction
- **Heuristic risk engine**: Weighted formula using real environmental factors for landslide scoring
- **Supabase backend**: 54 risk zones, 10 river stations, live predictions, satellite scenes

## Requirements

- Node.js 22+
- npm 11+

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

The app starts at `http://localhost:8080`.

## Useful scripts

```bash
npm run build
npm run preview
npm run test            # Run unit tests (Vitest)
npm run test:watch      # Watch mode for unit tests
npm run e2e             # Run Playwright E2E tests
npm run test:all        # Run unit + E2E tests
npm run playwright:install  # Install Playwright browsers
```

### Data ingestion

All ingestion scripts need `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set.

```bash
# Satellite scenes (Sentinel-1 RTC, Sentinel-2 L2A from Planetary Computer)
npm run ingest:satellite

# 7-day rainfall forecast (Open-Meteo API)
npm run ingest:rainfall

# River discharge → level (Open-Meteo Flood API)
npm run ingest:river-levels

# Flood predictions (from bahuraksha.onrender.com API)
npm run ingest:flood-predictions

# Landslide predictions (from trained ML model → Supabase)
npm run ingest:landslide-predictions
```

### Python scripts (data generation)

```bash
# Download 10 years of NASA POWER rainfall + estimate discharge
python scripts/ingest-real-csv-data.py --days 3650 --skip-sar

# Import 54 real Nepal districts + 13 Kathmandu municipalities
python scripts/import-real-risk-zones.py

# Generate heuristic landslide predictions from real API data
python scripts/import-real-landslide-data.py --days 7

# Generate ML-based landslide predictions (all 54 zones)
python scripts/generate-landslide-predictions.py

# Retrain ML models on real CSV data
cd bahuraksha-api
python train_flood_model.py
python train_landslide_model.py

cd ml-pipeline
python train.py --data-path data/landslide_inventory_enriched.csv --augment-real
```

### Backend

```bash
cd bahuraksha-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## End-to-end testing

Playwright uses Vite `test` mode and `.env.test`, which sets `VITE_DISABLE_AUTH=true`.

## Database

Supabase tables (all public SELECT via RLS for key hazard data):

| Table | Contents | Rows |
|---|---|---|
| `risk_zones` | Real Nepal districts + municipalities | 54 |
| `river_stations` | Bagmati River monitoring stations | 10 |
| `river_level_observations` | Live water levels | ~5 |
| `rainfall_forecasts` | 7-day Open-Meteo forecasts | ~7 |
| `landslide_predictions` | Heuristic + ML risk scores | 54 |
| `flood_predictions` | Flood risk probabilities | 12 |
| `sentinel_scenes` | Satellite overpass metadata | ~6 |

## Real data sources

| Source | Data | Key required |
|---|---|---|
| NASA POWER | Daily rainfall (1981–present) | None |
| USGS Earthquakes | Seismic activity (2.5+ mag) | None |
| Open-Meteo | Rainfall forecasts, flood API | None |
| Planetary Computer | Sentinel-1/2 scenes | None |
| ICIMOD | Nepal landslide inventory (50 events) | None |

## Current status

- **54 risk zones** with real Nepal geography, population, lat/lon
- **54 landslide predictions** updated daily from NASA POWER + USGS data
- **10 river stations** with real warning/danger thresholds
- **Trained ML models** ready for monsoon season (current dry-season features don't cross decision boundary)
- **Auth removed** from `/risk-map`, `/monitoring`, `/landslides` — fully public pages
- **Render cold-start** mitigated via seed CSV data fallback
