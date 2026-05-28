"""RED: get_dem_features should return elevation_m and slope_deg for any bbox."""
from main import get_dem_features


def test_get_dem_features_returns_expected_keys():
    """get_dem_features must return dict with elevation_m and slope_deg."""
    bbox = [86.0, 27.7, 86.6, 28.1]
    result = get_dem_features(bbox)
    assert "elevation_m" in result
    assert "slope_deg" in result
