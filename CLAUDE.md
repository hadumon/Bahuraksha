# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bahuraksha is a flood and landslide risk monitoring dashboard for Nepal's Bagmati Basin. It visualizes risk zones, river levels, rainfall forecasts, citizen reports, and satellite data.

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Supabase (PostgreSQL + Auth)
- React Router + TanStack Query
- Leaflet for maps
- Vitest + Playwright for testing

## Commands

```bash
# Development (runs on http://localhost:8080)
npm run dev

# Build
npm run build

# Unit tests (Vitest)
npm run test
npm run test:watch

# E2E tests (Playwright)
npm run e2e
npm run e2e:headed
npm run e2e:ui

# Run all tests
npm run test:all

# Install Playwright browsers
npm run playwright:install

# Satellite data ingestion
npm run ingest:satellite
```

## Project Structure

### Routing & Auth

Routes are defined in `src/components/auth/routeUtils.ts`. Public routes (`isPublic: true`) bypass authentication. All other routes are wrapped in `ProtectedRoute` which redirects to `/login` if unauthenticated.

Auth state is managed via `AuthContext` in `src/components/auth/AuthContext.tsx`. Use the `useAuth()` hook to access auth state.

### Data Layer

All Supabase queries live in `src/lib/operationalData.ts`. This file exports typed functions like `fetchRiskZones()`, `fetchRiverStations()`, `fetchDashboardStats()`, etc.

Each fetch function has a fallback to mock data when Supabase returns empty/error, allowing the UI to work without a live database.

Database tables include: `risk_zones`, `river_stations`, `river_level_observations`, `rainfall_forecasts`, `citizen_reports`, `alerts`, `data_sources`, `satellite_products`, `sentinel_scenes`, `profiles`.

### UI Components

shadcn/ui components are in `src/components/ui/`. The project uses the `sonner` toast component (import `{ toast } from "@/components/ui/sonner"`).

Custom page components are in `src/pages/`. Shared layout components (sidebar, etc.) are in `src/components/layout/`.

### Maps

Map components use React Leaflet (`react-leaflet`) and are in `src/components/map/`. Leaflet CSS is imported in `src/index.css`.

### Testing

- **Unit tests**: Vitest with jsdom. Test files: `src/**/*.{test,spec}.{ts,tsx}`. Setup in `src/test/setup.ts`.
- **E2E tests**: Playwright. Tests in `tests/` directory. Config at `playwright.config.ts`.

Playwright runs Vite in `test` mode (`.env.test` sets `VITE_DISABLE_AUTH=true`) to bypass authentication during e2e tests.

### Satellite Ingestion

The script at `scripts/ingest-satellite.mjs` pulls Sentinel-1 and Sentinel-2 data from Microsoft Planetary Computer STAC API into Supabase. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables.

### Supabase Integration

The Supabase client is at `src/integrations/supabase/client.ts`. Database types are auto-generated in `src/integrations/supabase/types.ts`. Migrations are in `supabase/migrations/`.

### Environment Variables

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase connection (public)
- `VITE_DISABLE_AUTH` - Set to `true` to disable auth (used in e2e tests)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` - Service role key for scripts (keep secret)

## Key Patterns

- **Path alias**: Use `@/` for imports from `src/` (e.g., `import { Button } from "@/components/ui/button"`)
- **Data fetching**: Use TanStack Query with the functions from `operationalData.ts`
- **Risk levels**: `"safe" | "watch" | "warning" | "evacuate"`
- **Mock fallbacks**: All data fetches fall back to `mockData.ts` when database is unavailable
