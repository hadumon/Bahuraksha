"""Tests for the LandslideEnricher that replaces synthetic features with real STAC data."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import numpy as np
from unittest.mock import patch, MagicMock

from raster_enricher import LandslideEnricher


class TestLandslideEnricherSchema:
    """The enricher must return the expected 14-feature schema for any point."""

    def test_enrich_point_returns_all_features(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)

        expected_keys = {
            "slope_angle_deg", "soil_moisture_pct", "rainfall_7d_mm",
            "rainfall_today_mm", "seismic_activity_mg", "vegetation_cover_pct",
            "elevation_m", "distance_to_road_km", "distance_to_river_km",
            "curvature", "aspect_deg", "ndvi", "lithology_code", "land_use_code",
        }

        assert isinstance(result, dict)
        assert set(result.keys()) == expected_keys

    def test_enrich_point_returns_float_values(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)

        for key, value in result.items():
            assert isinstance(value, (int, float, np.floating)), f"{key} is not numeric: {type(value)}"
            assert np.isfinite(value), f"{key} is not finite: {value}"

    def test_enrich_batch_returns_dataframe_with_all_features(self):
        enricher = LandslideEnricher()
        points = [
            {"latitude": 27.85, "longitude": 85.55},
            {"latitude": 27.70, "longitude": 85.30},
        ]
        df = enricher.enrich_batch(points)

        assert len(df) == 2
        for feature in enricher.FEATURE_KEYS:
            assert feature in df.columns


class TestLandslideEnricherCaching:
    """The enricher should cache raster tiles to avoid redundant STAC queries."""

    def test_enrich_point_caches_dem_tiles(self):
        enricher = LandslideEnricher()

        result1 = enricher.enrich_point(lat=27.85, lon=85.55)
        result2 = enricher.enrich_point(lat=27.85, lon=85.55)

        assert result1 == result2


class TestLandslideEnricherRealData:
    """Integration tests that the enricher produces physically plausible values."""

    def test_high_elevation_point_has_high_elevation(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=28.5, lon=84.0)
        assert result["elevation_m"] > 500

    def test_kathmandu_valley_elevation_reasonable(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.72, lon=85.32)
        assert 800 <= result["elevation_m"] <= 3000

    def test_ndvi_between_zero_and_one(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)
        assert 0.0 <= result["ndvi"] <= 1.0

    def test_slope_reasonable_range(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)
        assert 0 <= result["slope_angle_deg"] <= 70

    def test_land_use_code_in_valid_range(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)
        assert 1 <= result["land_use_code"] <= 5

    def test_aspect_between_zero_and_360(self):
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)
        assert 0 <= result["aspect_deg"] <= 360
