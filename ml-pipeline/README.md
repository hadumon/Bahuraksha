# Bahuraksha ML Pipeline

XGBoost-based landslide susceptibility prediction model for the Nepal/Himalayan region.

## Quick Start

```bash
cd ml-pipeline
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Training

```bash
# Train on synthetic data (default, 50k samples)
python train.py

# Train on real data
python train.py --data-path data/landslide_inventory.csv

# Custom output and sample count
python train.py --output-dir models --n-samples 100000
```

## Evaluation

```bash
python evaluate.py
```

Generates `evaluation_report.png` with ROC curve, precision-recall, confusion matrix, and feature importance.

## API Server

```bash
python api_server.py
```

Server runs at `http://localhost:8000`. OpenAPI docs at `http://localhost:8000/docs`.

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/model/info` | GET | Model metadata, metrics, feature importance |
| `/predict` | POST | Single location prediction |
| `/predict/batch` | POST | Batch prediction (up to 100 locations) |

### Example Request

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "slope_angle_deg": 42,
    "soil_moisture_pct": 85,
    "rainfall_7d_mm": 320,
    "rainfall_today_mm": 65,
    "seismic_activity_mg": 0.015,
    "vegetation_cover_pct": 25,
    "elevation_m": 1800,
    "distance_to_road_km": 0.3
  }'
```

## Tests

```bash
pytest tests/ -v
```

## Architecture

```
ml-pipeline/
├── config.py              # Model hyperparameters, feature list, thresholds
├── data_pipeline.py       # Synthetic data generation + real data loading
├── feature_engineering.py # Domain-specific feature transformations
├── train.py               # Training script with CV, calibration, export
├── evaluate.py            # Evaluation metrics + visualization
├── api_server.py          # FastAPI prediction server
├── models/                # Trained model artifacts (joblib)
├── data/                  # Input data (CSV)
└── tests/                 # Pipeline tests
```

## Model Details

- **Algorithm**: XGBoost with isotonic probability calibration
- **Features**: 14 raw + 6 engineered interactions = 20 total
- **Engineered features**: rainfall-soil coupling, slope-vegetation interaction, seismic-slope amplification, topographic wetness index, road-slope interaction, elevation-rainfall interaction
- **Risk thresholds**: evacuate (≥0.78), warning (≥0.58), watch (≥0.32), safe (<0.32)
- **Training data**: 50k synthetic samples with 8% positive rate (real data supported via CSV)
