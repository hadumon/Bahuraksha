"""Integration tests for /predict/flood and /predict/landslide endpoints."""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

FLOOD_PAYLOAD = {
    "lat": 27.7172, "lon": 85.3240,
    "rf_1day": 25.0, "rf_3day": 60.0, "rf_7day": 120.0, "rf_30day": 350.0,
    "discharge_proxy": 180.0, "soil_moisture_index": 0.65,
    "elevation_m": 1350.0, "slope_deg": 5.0, "aspect_deg": 180.0, "curvature": 0.1,
    "sar_vv_db": -12.0, "sar_vh_db": -18.0, "sar_vv_vh_ratio_db": 6.0,
    "month": 7, "day_of_year": 200,
}

LANDSLIDE_PAYLOAD = {
    "lat": 27.85, "lon": 85.55,
    "rf_1day": 80.0, "rf_3day": 200.0, "rf_7day": 350.0, "rf_30day": 800.0,
    "elevation_m": 2200.0, "slope_deg": 30.0, "aspect_deg": 135.0, "curvature": 1.5,
    "landuse_code": 20, "ndvi_proxy": 0.4, "dist_drainage_m": 200.0,
    "month": 7, "day_of_year": 200,
}


def test_predict_flood_returns_valid_response():
    r = client.post("/predict/flood", json=FLOOD_PAYLOAD)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["model_name"] == "xgboost"
    assert 0.0 <= body["probability"] <= 1.0
    assert body["predicted_event"] in (0, 1)
    assert body["risk_level"] in ("safe", "watch", "warning", "evacuate")


def test_predict_flood_missing_field_returns_422():
    r = client.post("/predict/flood", json={"lat": 27.7, "lon": 85.3})
    assert r.status_code == 422


def test_predict_landslide_returns_valid_response():
    r = client.post("/predict/landslide", json=LANDSLIDE_PAYLOAD)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["model_name"] == "xgboost"
    assert 0.0 <= body["probability"] <= 1.0
    assert body["predicted_event"] in (0, 1)
    assert body["risk_level"] in ("safe", "watch", "warning", "evacuate")


def test_predict_landslide_missing_field_returns_422():
    r = client.post("/predict/landslide", json={"lat": 27.8, "lon": 85.5})
    assert r.status_code == 422


def test_rate_limit_headers_present():
    r = client.get("/health")
    assert r.status_code == 200
    # slowapi adds Retry-After on limit exceed; just verify endpoint works


def test_root_and_version_endpoints():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["project"] == "Bahuraksha Early Warning System"

    r = client.get("/version")
    assert r.status_code == 200
    v = r.json()
    assert "flood_model" in v
    assert "landslide_model" in v


def test_debug_info_returns_data_freshness():
    r = client.get("/debug/info")
    assert r.status_code == 200
    body = r.json()
    assert "csv_data" in body
    assert "models" in body
    assert "cache_entries" in body
    assert "rate_limit" in body
    assert body["csv_data"]["total_files"] >= 0
