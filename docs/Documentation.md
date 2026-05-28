# Bahuraksha Project Documentation

## 1. Project Overview

Bahuraksha is a comprehensive flood and landslide risk monitoring and early warning dashboard designed specifically for Nepal's Bagmati Basin. The system consists of two primary components:
1. **Web Dashboard**: A React-based web application providing visualizations of risk zones, river levels, rainfall forecasts, citizen reports, and real-time satellite data.
2. **Early Warning System API**: A FastAPI-based Python backend that pulls satellite imagery (Sentinel-1 and Sentinel-2) from the Microsoft Planetary Computer STAC API, extracts features using Rasterio, and applies a Machine Learning (XGBoost) model to predict flood risks at the pixel level.

---

## 2. Technology Stack

### Frontend & Web Application
- **Framework**: React 18 with TypeScript, built using Vite.
- **Styling**: Tailwind CSS combined with shadcn/ui components for a polished, responsive interface.
- **State & Routing**: React Router for navigation, TanStack Query for efficient data fetching and caching.
- **Mapping & 3D Visualization**: Leaflet (via `react-leaflet`) for interactive 2D maps, and `react-three-fiber` / `react-three/drei` (Three.js) for high-fidelity 3D Digital Twin rendering.
- **Testing**: Vitest for unit testing and Playwright for end-to-end (e2e) testing.

### Backend & Database
- **Database**: PostgreSQL hosted on Supabase.
- **Authentication**: Supabase Auth (managed via context in the frontend).
- **APIs**: Direct database integration using the Supabase JS client (`@supabase/supabase-js`).

### Early Warning Machine Learning API (`bahuraksha-api`)
- **Framework**: FastAPI (Python).
- **Geospatial Processing**: `rasterio`, `numpy` for reading and processing STAC (SpatioTemporal Asset Catalog) items.
- **Machine Learning**: XGBoost (`xgboost`). A pre-trained model (`bahuraksha_xgb_model.ubj`) runs inferences on satellite data.
- **Data Source**: Microsoft Planetary Computer STAC API (Earth Search).

---

## 3. Project Architecture and Working

### 3.1. Web Dashboard Data Flow
1. **Routing and Authentication**: Users navigate the app via React Router. Protected routes require Supabase authentication. E2E testing bypasses auth using a `.env.test` configuration.
2. **Operational Data**: The file `src/lib/operationalData.ts` handles all data fetching operations (fetching risk zones, river stations, etc.). If the database is inaccessible, it elegantly falls back to a mocked dataset (`mockData.ts`), ensuring the UI never breaks.
3. **User Interface**: Pages are built using a collection of modular components from `shadcn/ui` and custom layouts.

### 3.2. Machine Learning Pipeline (`bahuraksha-api`)
The early warning prediction pipeline works as follows:
1. **Request Reception**: An endpoint (e.g., `/predict` or `/latest`) receives a prediction request for a specific bounding box and date.
2. **Data Acquisition**: The API queries the STAC API for Sentinel-2 L2A (optical) and Sentinel-1 GRD (radar) scenes intersecting the Bagmati Basin bounding box (`[86.0, 27.7, 86.6, 28.1]`).
3. **Feature Engineering**:
   - **Optical (S2)**: Reads bands B2, B3, B4, B8, B11, B12 to compute indices like NDWI (water), NDSI (snow), and NDVI (vegetation).
   - **Radar (S1)**: Reads VH and VV bands and converts them to decibels (dB).
   - **Change Detection**: Computes differences in indices (`dNDWI`, `dNDSI`, `dNDVI`) against a reference date (60 days prior).
4. **Prediction**: Constructs a 16-element feature vector and feeds it into the XGBoost classifier.
5. **Output generation**: Generates a risk score derived from the XGBoost flood probability prediction combined with the SAR (Synthetic Aperture Radar) signal strength. Returns a JSON payload containing the predicted class (dry land, flood water, or snow/glacier), confidence, and risk score.
6. **Robustness & Fallbacks**: The frontend API client (`bahuraksha-api.ts`) implements a circuit-breaker pattern. If the Render-hosted model endpoint is down or cold-starting, it catches the error and returns a realistic "mock" payload flagged with `isMock: true`. This ensures the composite risk engine and dashboard remain functional even during temporary API outages.

### 3.3. Background Ingestion Tasks
- **Satellite Data Ingestion**: Node.js scripts (`scripts/ingest-satellite.mjs`, `scripts/ingest-rainfall.mjs`) run on a schedule to fetch metadata from STAC and write it into the Supabase database (`public.sentinel_scenes`). This ensures the database is continually updated with references to the latest satellite passes.

### 3.4. Cinematic 3D Digital Twin (`DigitalTwinPanel.tsx`)
A standout feature of the web dashboard is the real-time 3D Digital Twin of the Bagmati river basin. This component acts as a high-fidelity virtual representation of the monitoring area:
- **Procedural PBR Terrain**: Generates a realistic, meandering river channel dynamically using mathematical noise (Simplex) mapped to a Physically Based Rendering (PBR) `MeshStandardMaterial`.
- **Advanced Water Simulation**: Employs a `MeshTransmissionMaterial` to mimic actual physical water properties, calculating light refraction, chromatic aberration, and depth. The water level responds directly to the aggregated telemetry from real-world sensors.
- **HTML/DOM Overlays**: Renders responsive UI tooltips perfectly synced into the 3D space (`<Html>` from Drei) over the sensor nodes, reflecting real-time live metrics and statuses without suffering from texture pixelation.
- **Cinematic Experience**: Designed with atmospheric fog, dual-tone spot lighting, ambient occlusion (`ContactShadows`), particle systems (`Sparkles`), and a smooth, auto-rotating programmatic camera.

### 3.5. Landslide Prediction UI (`LandslidesPage.tsx`)
A dedicated dashboard interface for visualizing geospatial landslide susceptibility:
- **Geospatial Metrics**: Displays top-level indicators for Soil Moisture, Slope Instability, and Seismic Activity.
- **Correlation Chart**: Integrates a `recharts`-based interactive Area Chart to map Risk Probability against Soil Saturation levels over time.
- **Susceptible Zones Feed**: Lists high-risk districts with interactive progress bars that directly correspond to calculated slope failure probability.

### 3.7. Synthetic Hydrological Routing (HEC-RAS Proxy)
To provide depth-based risk metrics without the high cost of manual channel surveys, the app implements a physical routing engine:
- **Manning's Equation Logic**: Calculates water depth and velocity at specific cross-sections (Sundarijal, Pashupati, Teku, Chovar) using bed slope, channel width, and Manning's roughness coefficients.
- **Dynamic Inputs**: Uses live rainfall forecasts from Open-Meteo as the primary inflow driver, routed through the catchment using the Rational Method.
- **Risk Thresholds**: Categorizes results into Watch, Warning, and Evacuate based on calculated water surface elevation relative to local danger marks.
- **Station Metadata**: Cross-sections include technical attributes like `leftOverbankN`, `channelN`, and `bankfullWidthM` for high-fidelity simulation.

### 3.8. Dynamic Heatmap Risk Map (`RiskMap.tsx`)
The central map interface utilizes custom, mathematically scaled gradient markers to visualize danger zones:
- **Radial CSS Gradients**: Employs native CSS `radial-gradient` via Leaflet's `divIcon` to create highly realistic heatmaps. Zones with an "evacuate" status emit an intense red core that fades out smoothly through orange and yellow.
- **Screen Blend Modes**: Utilizes `mix-blend-mode: screen` on the markers so that overlapping danger zones visually compound and intensify in brightness.
- **Population Scaling**: Danger zone radii are mathematically scaled based on the square root of the local population size, ensuring accurate representation without overwhelming the viewport.
- **De-cluttered Overlays**: Satellite data footprints are rendered with low opacity and dashed borders to avoid obstructing the primary topological and heatmap data.

---

## 4. Development and Commands

### Running the Web Dashboard
```bash
npm install
npm run dev     # Runs development server on http://localhost:8080
npm run build   # Builds the app for production
```

### Running Tests
```bash
npm run test          # Unit tests (Vitest)
npm run e2e           # End-to-end tests (Playwright)
npm run test:all      # Run all tests
```

### Running the Python ML API
```bash
cd bahuraksha-api
pip install -r requirements.txt # (or install dependencies manually)
uvicorn main:app --reload --port 8000
```

### Running Ingestion Scripts
```bash
# Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in the environment
npm run ingest:satellite
npm run ingest:rainfall
```

## 5. Directory Structure
* `/bahuraksha-api`: Contains the Python FastAPI codebase and XGBoost model for the early warning system.
* `/src`: Contains the React web application codebase.
  * `/components`: UI and map components.
  * `/lib`: Utility functions and Supabase operational data fetchers.
  * `/pages`: Top-level page views.
* `/supabase/migrations`: SQL migrations to set up the Postgres schema.
* `/scripts`: Node.js scripts for continuous data ingestion into Supabase.
* `/tests`: Playwright end-to-end testing specifications.
* `/docs`: Project documentation files.
