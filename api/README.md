# Bahurakshaa Phase 5 API

## Run

Install deps:

```bash
pip install -r requirements.txt
```

Start API:

```bash
uvicorn api.main:app --reload --port 8000
```

Swagger docs:

- http://127.0.0.1:8000/docs

## Endpoints

- `GET /health`
- `POST /predict/flood`
- `POST /predict/landslide`
- `GET /risk/zones`
- `GET /risk/zones/live`
- `POST /ingest/satellite`

## Example: Flood prediction

```bash
curl -X POST http://127.0.0.1:8000/predict/flood \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-08-01",
    "lat": 27.71,
    "lon": 85.35,
    "rf_1day": 45.2,
    "rf_3day": 120.1,
    "rf_7day": 210.5,
    "rf_30day": 760.2,
    "discharge_proxy": 180.0,
    "soil_moisture_index": 0.36,
    "elevation_m": 1310,
    "slope_deg": 9.8,
    "aspect_deg": 145.0,
    "curvature": 0.001,
    "sar_vv_db": -8.7,
    "sar_vh_db": -14.2
  }'
```

## Example: Composite risk

```bash
curl "http://127.0.0.1:8000/risk/zones?zone_name=Teku&flood_prob=0.82&landslide_prob=0.35&rainfall_score=0.70"
```

## Example: Live zone risks (model-backed)

```bash
curl "http://127.0.0.1:8000/risk/zones/live"
```

Optional date (uses latest data on or before the date):

```bash
curl "http://127.0.0.1:8000/risk/zones/live?date=2025-10-15"
```
