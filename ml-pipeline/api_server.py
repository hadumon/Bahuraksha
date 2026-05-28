import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import FEATURES, MODEL_CONFIG

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Bahuraksha Landslide Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_artifacts = None
model_dir = Path(__file__).parent / "models"


def load_model():
    global model_artifacts
    model_path = model_dir / "landslide_model.joblib"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found at {model_path}. Run 'python train.py' first."
        )
    model_artifacts = joblib.load(model_path)
    logger.info(f"Model loaded from {model_path}")
    return model_artifacts


class LandslideInput(BaseModel):
    slope_angle_deg: float = Field(ge=0, le=90, description="Slope angle in degrees")
    soil_moisture_pct: float = Field(ge=0, le=100, description="Soil moisture percentage")
    rainfall_7d_mm: float = Field(ge=0, description="7-day cumulative rainfall in mm")
    rainfall_today_mm: float = Field(ge=0, description="Today's rainfall in mm")
    seismic_activity_mg: float = Field(ge=0, description="Seismic activity in g")
    vegetation_cover_pct: float = Field(ge=0, le=100, description="Vegetation cover percentage")
    elevation_m: float = Field(ge=0, description="Elevation in meters")
    distance_to_road_km: float = Field(ge=0, description="Distance to nearest road in km")
    distance_to_river_km: float = Field(ge=0, default=1.0, description="Distance to nearest river in km")
    curvature: float = Field(default=0.0, description="Terrain curvature")
    aspect_deg: float = Field(default=180.0, ge=0, le=360, description="Slope aspect in degrees")
    ndvi: float = Field(default=0.5, ge=0, le=1, description="Normalized Difference Vegetation Index")
    lithology_code: float = Field(default=3.0, ge=1, le=5, description="Lithology classification code")
    land_use_code: float = Field(default=3.0, ge=1, le=5, description="Land use classification code")


class PredictionResponse(BaseModel):
    probability: float
    risk_level: str
    susceptibility_score: float
    primary_driver: str
    secondary_drivers: list[str]
    confidence: float
    time_horizon_hours: int = 72
    feature_contributions: dict[str, float]


class BatchPredictionRequest(BaseModel):
    locations: list[LandslideInput]


class BatchPredictionResponse(BaseModel):
    predictions: list[PredictionResponse]
    count: int


class ModelInfoResponse(BaseModel):
    model_type: str
    n_features: int
    feature_names: list[str]
    n_training_samples: int
    metrics: dict
    thresholds: dict
    feature_importance: list[dict]


@app.on_event("startup")
def startup_event():
    load_model()


@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": model_artifacts is not None}


@app.get("/model/info", response_model=ModelInfoResponse)
def model_info():
    if model_artifacts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return ModelInfoResponse(
        model_type="XGBoost + Isotonic Calibration",
        n_features=len(model_artifacts["feature_names"]),
        feature_names=model_artifacts["feature_names"],
        n_training_samples=50000,
        metrics=model_artifacts["metrics"],
        thresholds=model_artifacts["thresholds"],
        feature_importance=model_artifacts["feature_importance"],
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(input_data: LandslideInput):
    if model_artifacts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        features = {
            "slope_angle_deg": input_data.slope_angle_deg,
            "soil_moisture_pct": input_data.soil_moisture_pct,
            "rainfall_7d_mm": input_data.rainfall_7d_mm,
            "rainfall_today_mm": input_data.rainfall_today_mm,
            "seismic_activity_mg": input_data.seismic_activity_mg,
            "vegetation_cover_pct": input_data.vegetation_cover_pct,
            "elevation_m": input_data.elevation_m,
            "distance_to_road_km": input_data.distance_to_road_km,
            "distance_to_river_km": input_data.distance_to_river_km,
            "curvature": input_data.curvature,
            "aspect_deg": input_data.aspect_deg,
            "ndvi": input_data.ndvi,
            "lithology_code": input_data.lithology_code,
            "land_use_code": input_data.land_use_code,
        }

        X_raw = pd.DataFrame([features])
        engineer = model_artifacts["engineer"]
        X = engineer.transform(X_raw)

        calibrated = model_artifacts["calibrated_model"]
        probability = float(calibrated.predict_proba(X)[0, 1])

        thresholds = model_artifacts["thresholds"]
        if probability >= thresholds["evacuate"]:
            risk_level = "evacuate"
        elif probability >= thresholds["warning"]:
            risk_level = "warning"
        elif probability >= thresholds["watch"]:
            risk_level = "watch"
        else:
            risk_level = "safe"

        base_model = model_artifacts["base_model"]
        importance = base_model.feature_importances_
        feature_names = model_artifacts["feature_names"]
        contributions = {
            name: float(imp) for name, imp in zip(feature_names, importance)
        }

        sorted_contributions = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        primary_driver = sorted_contributions[0][0] if sorted_contributions else "unknown"
        secondary_drivers = [c[0] for c in sorted_contributions[1:4]]

        confidence = min(0.95, 0.75 + abs(probability - 0.5) * 0.4)

        return PredictionResponse(
            probability=round(probability, 4),
            risk_level=risk_level,
            susceptibility_score=round(probability, 4),
            primary_driver=primary_driver,
            secondary_drivers=secondary_drivers,
            confidence=round(confidence, 4),
            time_horizon_hours=72,
            feature_contributions={k: round(v, 6) for k, v in contributions.items()},
        )

    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch", response_model=BatchPredictionResponse)
def predict_batch(request: BatchPredictionRequest):
    if model_artifacts is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if len(request.locations) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 locations per batch")

    predictions = []
    for loc in request.locations:
        pred = predict(loc)
        predictions.append(pred)

    return BatchPredictionResponse(predictions=predictions, count=len(predictions))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
