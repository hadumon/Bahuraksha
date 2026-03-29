# Bahuraksha

## Requirements

- Node.js 22+
- npm 11+

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

The app starts at `http://localhost:8080`.

## Useful scripts

```bash
npm run build
npm run preview
npm run test
npm run e2e
npm run test:all
npm run playwright:install
npm run ingest:satellite
```

## End-to-end testing

Playwright uses Vite `test` mode and `.env.test`, which sets:

```bash
VITE_DISABLE_AUTH=true
```

That lets the e2e suite run locally without a seeded authentication account.

## Real Operational Data

The app now supports Supabase-backed operational tables for:

- `risk_zones`
- `river_stations`
- `river_level_observations`
- `rainfall_forecasts`
- `data_sources`
- `satellite_products`
- `profiles`

Apply the new SQL migration in `supabase/migrations` to your Supabase project before expecting live data in the UI.

## Satellite Ingestion

Use the ingestion scaffold to pull STAC-compatible satellite metadata into Supabase:

```bash
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:SATELLITE_STAC_API="https://your-stac-api/search"
$env:SATELLITE_COLLECTION="sentinel-1-grd"
$env:SATELLITE_SOURCE_SLUG="sentinel-1-sar"
$env:SATELLITE_PRODUCT_TYPE="flood_extent"
$env:SATELLITE_REGION="Bagmati Basin"
$env:SATELLITE_BBOX="85.20,27.60,85.45,27.82"
npm run ingest:satellite
```

Optional env vars:

- `SATELLITE_DATETIME`
- `SATELLITE_LIMIT`
- `SATELLITE_RISK_LEVEL`
- `SATELLITE_FLOOD_AREA_KM2`
- `SATELLITE_CLOUD_COVER`
- `SATELLITE_RESOLUTION_METERS`
- `SATELLITE_SOURCE_NAME`
- `SATELLITE_SOURCE_DESCRIPTION`
