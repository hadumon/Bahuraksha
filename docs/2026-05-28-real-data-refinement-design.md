# Real Data Refinement — Design

## Goal

Make the Bahuraksha flood detection API genuinely production-ready and improve the landslide model's training data with real raster sources for a 7th semester final project demo.

## Approach Chosen: C — Real Flood + Partial Landslide

Focus on the flood API (closer to production) plus partial real-data enrichment for the landslide model.

## Section 1: Flood API Improvements

### 1a. Fix hardcoded elevation/slope

- Replace `AOI_ELEVATION_M = 2850.0` and `AOI_SLOPE_DEG = 18.5` with DEM runtime queries
- Query Copernicus DEM (`cop-dem-glo-30`) from Earth Search STAC at the requested bbox center
- Sample a 3×3 pixel window, return mean elevation
- Compute slope from DEM window using a simple gradient method
- Every prediction becomes spatially aware

### 1b. Flood model training script

- New file: `bahuraksha-api/train_flood_model.py`
- Queries 50+ real S1+S2 scenes from Earth Search over diverse dates/bboxes in Nepal
- Extracts all 16 features from each scene
- Generates semi-automated labels using NDWI + SAR backscatter thresholds
- Trains a new XGBoost multi-class model
- Outputs `model.ubj` + `model_metadata.json` with evaluation

### 1c. In-memory cache

- Simple dict cache keyed by `(date, bbox_str)` with 5-minute TTL
- Reduces repeated STAC queries

### 1d. Error hardening

- Log warning when all bands return NaN instead of silently predicting on zeros

## Section 2: Landslide Raster Enrichment

### 2a. Build raster_enricher.py

- `LandslideEnricher` class with tile-level caching
- PC STAC sources: ALOS DEM (elevation, slope, aspect, curvature), Sentinel-2 L2A (NDVI), CHIRPS (rainfall), ESA WorldCover (land use)

### 2b. Rewrite enrich_with_environmental_features()

- Replace the random-noise enrichment function with calls to the real enricher
- Keep the same 14-feature schema

## Section 3: Frontend Polish

- Ensure the demo flow doesn't fall back to mock data when the API is reachable
- Update ModelStatusPanel to show real-vs-mock status clearly

## Files Changed

- `bahuraksha-api/main.py` — DEM query, caching, error hardening
- `bahuraksha-api/train_flood_model.py` — new
- `bahuraksha-api/requirements.txt` — add richdem
- `ml-pipeline/raster_enricher.py` — new
- `ml-pipeline/ingest_real_data.py` — use real enricher
- `ml-pipeline/requirements.txt` — add pystac-client, planetary-computer, rasterio, geopandas
