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
$env:SUPABASE_SERVICE_KEY="your-service-role-key"
npm run ingest:satellite
```

This script uses the Microsoft Planetary Computer STAC API and ingests:

- `sentinel-1-rtc`
- `sentinel-2-l2a`

It writes rows into `public.sentinel_scenes`.
