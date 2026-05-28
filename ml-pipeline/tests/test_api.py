import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient

from api_server import app, load_model


@pytest.fixture(scope="session", autouse=True)
def ensure_model_loaded():
    load_model()


@pytest.fixture
def client():
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_healthy(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["model_loaded"] is True


class TestModelInfoEndpoint:
    def test_model_info_returns_metadata(self, client):
        response = client.get("/model/info")
        assert response.status_code == 200
        data = response.json()
        assert "model_type" in data
        assert "n_features" in data
        assert "feature_names" in data
        assert "metrics" in data
        assert "thresholds" in data
        assert "feature_importance" in data
        assert data["n_features"] == 20


class TestPredictEndpoint:
    def test_predict_single_location(self, client):
        payload = {
            "slope_angle_deg": 42,
            "soil_moisture_pct": 85,
            "rainfall_7d_mm": 300,
            "rainfall_today_mm": 50,
            "seismic_activity_mg": 0.01,
            "vegetation_cover_pct": 30,
            "elevation_m": 1500,
            "distance_to_road_km": 0.5,
        }

        response = client.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert "probability" in data
        assert "risk_level" in data
        assert "susceptibility_score" in data
        assert "primary_driver" in data
        assert "secondary_drivers" in data
        assert "confidence" in data
        assert "time_horizon_hours" in data
        assert "feature_contributions" in data

        assert 0 <= data["probability"] <= 1
        assert 0 <= data["susceptibility_score"] <= 1
        assert 0 <= data["confidence"] <= 1
        assert data["risk_level"] in ["safe", "watch", "warning", "evacuate"]
        assert len(data["secondary_drivers"]) > 0
        assert len(data["feature_contributions"]) == 20

    def test_predict_low_risk_location(self, client):
        payload = {
            "slope_angle_deg": 10,
            "soil_moisture_pct": 20,
            "rainfall_7d_mm": 10,
            "rainfall_today_mm": 2,
            "seismic_activity_mg": 0.0005,
            "vegetation_cover_pct": 80,
            "elevation_m": 300,
            "distance_to_road_km": 5,
        }

        response = client.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["risk_level"] == "safe"
        assert data["probability"] < 0.32

    def test_predict_high_risk_location(self, client):
        payload = {
            "slope_angle_deg": 50,
            "soil_moisture_pct": 95,
            "rainfall_7d_mm": 400,
            "rainfall_today_mm": 80,
            "seismic_activity_mg": 0.1,
            "vegetation_cover_pct": 10,
            "elevation_m": 3000,
            "distance_to_road_km": 0.1,
        }

        response = client.post("/predict", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["risk_level"] == "evacuate"
        assert data["probability"] >= 0.78

    def test_predict_validation_errors(self, client):
        payload = {
            "slope_angle_deg": -10,
            "soil_moisture_pct": 150,
            "rainfall_7d_mm": -5,
            "rainfall_today_mm": -1,
            "seismic_activity_mg": -0.1,
            "vegetation_cover_pct": 200,
            "elevation_m": -100,
            "distance_to_road_km": -1,
        }

        response = client.post("/predict", json=payload)
        assert response.status_code == 422

    def test_predict_missing_fields(self, client):
        payload = {
            "slope_angle_deg": 30,
        }

        response = client.post("/predict", json=payload)
        assert response.status_code == 422


class TestBatchPredictEndpoint:
    def test_batch_predict_multiple_locations(self, client):
        locations = [
            {
                "slope_angle_deg": 42,
                "soil_moisture_pct": 85,
                "rainfall_7d_mm": 300,
                "rainfall_today_mm": 50,
                "seismic_activity_mg": 0.01,
                "vegetation_cover_pct": 30,
                "elevation_m": 1500,
                "distance_to_road_km": 0.5,
            },
            {
                "slope_angle_deg": 10,
                "soil_moisture_pct": 20,
                "rainfall_7d_mm": 10,
                "rainfall_today_mm": 2,
                "seismic_activity_mg": 0.0005,
                "vegetation_cover_pct": 80,
                "elevation_m": 300,
                "distance_to_road_km": 5,
            },
        ]

        response = client.post("/predict/batch", json={"locations": locations})
        assert response.status_code == 200
        data = response.json()

        assert data["count"] == 2
        assert len(data["predictions"]) == 2

        assert data["predictions"][0]["risk_level"] == "evacuate"
        assert data["predictions"][1]["risk_level"] == "safe"

    def test_batch_predict_too_many_locations(self, client):
        locations = [
            {
                "slope_angle_deg": 30,
                "soil_moisture_pct": 50,
                "rainfall_7d_mm": 100,
                "rainfall_today_mm": 10,
                "seismic_activity_mg": 0.002,
                "vegetation_cover_pct": 60,
                "elevation_m": 1000,
                "distance_to_road_km": 2,
            }
            for _ in range(101)
        ]

        response = client.post("/predict/batch", json={"locations": locations})
        assert response.status_code == 400
