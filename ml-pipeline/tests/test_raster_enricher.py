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


class TestLandslideEnricherFallback:
    """The enricher must fall back to synthetic features when STAC is unavailable."""

    @patch("raster_enricher.LandslideEnricher._search_dem")
    def test_fallback_on_stac_failure(self, mock_search_dem):
        mock_search_dem.side_effect = RuntimeError("STAC API unreachable")
        enricher = LandslideEnricher()
        result = enricher.enrich_point(lat=27.85, lon=85.55)
        assert isinstance(result, dict)
        assert set(result.keys()) == {
            "slope_angle_deg", "soil_moisture_pct", "rainfall_7d_mm",
            "rainfall_today_mm", "seismic_activity_mg", "vegetation_cover_pct",
            "elevation_m", "distance_to_road_km", "distance_to_river_km",
            "curvature", "aspect_deg", "ndvi", "lithology_code", "land_use_code",
        }
        for v in result.values():
            assert isinstance(v, (int, float, np.floating))
            assert np.isfinite(v)

    def test_fallback_result_is_deterministic(self):
        enricher = LandslideEnricher()
        # Disable STAC by default — use synthetic
        enricher.use_stac = False
        result1 = enricher.enrich_point(lat=28.0, lon=84.5)
        result2 = enricher.enrich_point(lat=28.0, lon=84.5)
        assert result1 == result2


class TestLandslideEnricherSentinel2:
    """The enricher should use Sentinel-2 data for NDVI and vegetation cover."""

    @staticmethod
    def _make_mock_s2_item(red_val: float = 0.2, nir_val: float = 0.6):
        """Create a mock Sentinel-2 STAC item with known band values."""
        import json
        item = {
            "assets": {
                "red": {"href": f"https://mock/s2/red_{red_val}.tif"},
                "nir": {"href": f"https://mock/s2/nir_{nir_val}.tif"},
            },
            "properties": {
                "datetime": "2024-06-01T00:00:00Z",
                "eo:cloud_cover": 10,
            },
        }
        return item

    @patch("raster_enricher.LandslideEnricher._search_sentinel2")
    @patch("raster_enricher.LandslideEnricher._read_s2_features")
    def test_enrich_point_uses_sentinel2_ndvi(self, mock_read_s2, mock_search_s2):
        """When S2 is available, enrich_point should use real NDVI."""
        mock_read_s2.return_value = {"ndvi": 0.65, "vegetation_cover_pct": 72.0}
        enricher = LandslideEnricher()
        with patch.object(enricher, "_search_dem") as mock_dem, \
             patch.object(enricher, "_read_dem_features") as mock_read_dem, \
             patch.object(enricher, "_search_worldcover") as mock_wc, \
             patch.object(enricher, "_read_worldcover_code") as mock_read_wc:
            mock_dem.return_value = {}
            mock_read_dem.return_value = {
                "elevation_m": 1500.0, "slope_angle_deg": 25.0,
                "aspect_deg": 180.0, "curvature": 0.0,
            }
            mock_wc.return_value = {}
            mock_read_wc.return_value = {"land_use_code": 3.0}
            result = enricher.enrich_point(lat=27.85, lon=85.55)

        assert result["ndvi"] == 0.65
        assert result["vegetation_cover_pct"] == 72.0
        mock_search_s2.assert_called_once()

    @patch("raster_enricher.LandslideEnricher._search_sentinel2")
    def test_sentinel2_fallback_to_synthetic(self, mock_search_s2):
        """When S2 is unavailable, enricher falls back to synthetic NDVI."""
        mock_search_s2.side_effect = RuntimeError("S2 unavailable")
        enricher = LandslideEnricher()
        with patch.object(enricher, "_search_dem") as mock_dem, \
             patch.object(enricher, "_read_dem_features") as mock_read_dem, \
             patch.object(enricher, "_search_worldcover") as mock_wc, \
             patch.object(enricher, "_read_worldcover_code") as mock_read_wc:
            mock_dem.return_value = {}
            mock_read_dem.return_value = {
                "elevation_m": 1500.0, "slope_angle_deg": 25.0,
                "aspect_deg": 180.0, "curvature": 0.0,
            }
            mock_wc.return_value = {}
            mock_read_wc.return_value = {"land_use_code": 3.0}
            result = enricher.enrich_point(lat=27.85, lon=85.55)

        assert 0.0 <= result["ndvi"] <= 1.0
        assert 5 <= result["vegetation_cover_pct"] <= 95

    @patch("raster_enricher.LandslideEnricher._search_sentinel2")
    @patch("raster_enricher.LandslideEnricher._read_s2_features")
    def test_sentinel2_ndvi_is_cached(self, mock_read_s2, mock_search_s2):
        """Caching should prevent redundant S2 queries for the same point."""
        mock_read_s2.return_value = {"ndvi": 0.65, "vegetation_cover_pct": 72.0}
        enricher = LandslideEnricher()
        with patch.object(enricher, "_search_dem") as mock_dem, \
             patch.object(enricher, "_read_dem_features") as mock_read_dem, \
             patch.object(enricher, "_search_worldcover") as mock_wc, \
             patch.object(enricher, "_read_worldcover_code") as mock_read_wc:
            mock_dem.return_value = {}
            mock_read_dem.return_value = {
                "elevation_m": 1500.0, "slope_angle_deg": 25.0,
                "aspect_deg": 180.0, "curvature": 0.0,
            }
            mock_wc.return_value = {}
            mock_read_wc.return_value = {"land_use_code": 3.0}
            enricher.enrich_point(lat=27.85, lon=85.55)
            enricher.enrich_point(lat=27.85, lon=85.55)

        mock_search_s2.assert_called_once()


class TestLandslideEnricherWorldCover:
    """The enricher should use ESA WorldCover data for land use codes."""

    @patch("raster_enricher.LandslideEnricher._read_worldcover_code")
    @patch("raster_enricher.LandslideEnricher._search_worldcover")
    def test_enrich_point_uses_worldcover(self, mock_search_wc, mock_read_wc):
        mock_read_wc.return_value = {"land_use_code": 4.0}
        enricher = LandslideEnricher()
        with patch.object(enricher, "_search_dem") as mock_dem, \
             patch.object(enricher, "_read_dem_features") as mock_read_dem, \
             patch.object(enricher, "_search_sentinel2") as mock_s2, \
             patch.object(enricher, "_read_s2_features") as mock_read_s2:
            mock_dem.return_value = {}
            mock_read_dem.return_value = {"elevation_m": 1500.0, "slope_angle_deg": 25.0,
                                          "aspect_deg": 180.0, "curvature": 0.0}
            mock_s2.return_value = {}
            mock_read_s2.return_value = {"ndvi": 0.5, "vegetation_cover_pct": 60.0}
            result = enricher.enrich_point(lat=27.85, lon=85.55)

        assert result["land_use_code"] == 4.0
        mock_search_wc.assert_called_once()

    @patch("raster_enricher.LandslideEnricher._search_worldcover")
    def test_worldcover_fallback_to_synthetic(self, mock_search_wc):
        mock_search_wc.side_effect = RuntimeError("WorldCover unavailable")
        enricher = LandslideEnricher()
        with patch.object(enricher, "_search_dem") as mock_dem, \
             patch.object(enricher, "_read_dem_features") as mock_read_dem, \
             patch.object(enricher, "_search_sentinel2") as mock_s2, \
             patch.object(enricher, "_read_s2_features") as mock_read_s2:
            mock_dem.return_value = {}
            mock_read_dem.return_value = {"elevation_m": 1500.0, "slope_angle_deg": 25.0,
                                          "aspect_deg": 180.0, "curvature": 0.0}
            mock_s2.return_value = {}
            mock_read_s2.return_value = {"ndvi": 0.5, "vegetation_cover_pct": 60.0}
            result = enricher.enrich_point(lat=27.85, lon=85.55)

        assert 1 <= result["land_use_code"] <= 5
