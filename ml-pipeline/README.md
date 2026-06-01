# Bahuraksha ML Pipeline

XGBoost-based landslide susceptibility prediction model for the Nepal/Himalayan region, trained on real ICIMOD inventory data augmented with synthetic samples.

## Quick Start

```bash
cd ml-pipeline
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Training

```bash
# Train on synthetic data only (default, 50k samples)
python train.py

# Train on real ICIMOD data + synthetic augmentation (recommended)
python train.py --data-path data/landslide_inventory_enriched.csv --augment-real

# Train on real data only (no synthetic)
python train.py --data-path data/landslide_inventory_enriched.csv --no-synthetic

# Custom augmentation ratio (default 10:1 synthetic:real)
python train.py --data-path data/landslide_inventory_enriched.csv --augment-real --augment-ratio 20

# Custom sample count (synthetic only)
python train.py --n-samples 100000
```

Real data file: `data/landslide_inventory_enriched.csv` — 550 samples (50 real ICIMOD positives + 500 synthetic negatives with environmental features).

### Training Metrics (ICIMOD + synthetic augmentation)

| Metric | Value |
|---|---|
| CV ROC-AUC | 0.875 |
| CV Avg Precision | 0.561 |
| CV F1 | 0.532 |
| CV Precision | 0.477 |
| CV Recall | 0.603 |
| Training ROC-AUC | 0.998 |
| Positive rate | 11.0% |

## Real data ingestion

```bash
# Ingest ICIMOD landslide inventory → enriched with environmental features
python ingest_real_data.py --source icimod --input data/icimod_inventory.csv
```

Generates `data/landslide_inventory_enriched.csv` with per-point features (elevation, slope, rainfall, seismic, NDVI, etc.).

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
├── feature_engineering.py # Domain-specific feature transformations (20 features)
├── train.py               # Training script with CV, calibration, export
├── evaluate.py            # Evaluation metrics + visualization
├── ingest_real_data.py    # ICIMOD/NASA LHASA/DHM data ingestion → enrichment
├── raster_enricher.py     # STAC raster enrichment for real data points
├── api_server.py          # FastAPI prediction server
├── models/                # Trained model artifacts (joblib)
│   ├── landslide_model.joblib   # Full model bundle
│   └── model_metadata.json      # Training metrics + config
├── data/                  # Input data (CSV)
│   ├── icimod_inventory.csv
│   └── landslide_inventory_enriched.csv
└── tests/                 # Pipeline tests
```

## Model Details

- **Algorithm**: XGBoost with isotonic probability calibration
- **Features**: 14 raw + 6 engineered interactions = 20 total
- **Raw features**: slope_angle_deg, soil_moisture_pct, rainfall_7d_mm, rainfall_today_mm, seismic_activity_mg, vegetation_cover_pct, elevation_m, distance_to_road_km, distance_to_river_km, curvature, aspect_deg, ndvi, lithology_code, land_use_code
- **Engineered features**: rainfall_soil_coupling, slope_vegetation_interaction, seismic_slope_amplification, topographic_wetness_idx, road_slope_interaction, elevation_rainfall_interaction
- **Top predictors**: road_slope_interaction (13.3%), slope_angle_deg (8.7%), elevation_rainfall_interaction (6.5%)
- **Risk thresholds**: evacuate (≥0.78), warning (≥0.58), watch (≥0.32), safe (<0.32)
- **Training data**: 50 real ICIMOD positives + 5,500 synthetic (augment-real mode)
- **Note**: Isotonic calibration produces conservative probabilities — most useful during monsoon season when feature values cross the model's learned decision boundary. For dry-season predictions, the heuristic model (in `bahuraksha-api`) provides better differentiation.
