"""Tests for satellite.py DEM query and dynamic elevation/slope integration."""
from satellite import get_dem_features, build_feature_vector


def test_get_dem_features_returns_expected_keys():
    """get_dem_features must return dict with elevation_m and slope_deg."""
    bbox = [86.0, 27.7, 86.6, 28.1]
    result = get_dem_features(bbox)
    assert "elevation_m" in result
    assert "slope_deg" in result


def test_build_feature_vector_uses_dynamic_dem():
    """build_feature_vector should use provided elevation/slope, not hardcoded."""
    s2 = {
        "B2": 0.1, "B3": 0.2, "B4": 0.3, "B8": 0.4, "B11": 0.5, "B12": 0.6,
        "NDWI": 0.1, "NDSI": 0.2, "NDVI": 0.3,
    }
    change = {"dNDWI": 0.01, "dNDSI": 0.02, "dNDVI": 0.03}
    s1 = {"VH_db": -15.0, "VV_db": -10.0}

    X = build_feature_vector(s2, s1, change, elevation_m=3000.0, slope_deg=15.0)
    assert X[0][-2] == 3000.0
    assert X[0][-1] == 15.0
