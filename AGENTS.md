# AGENTS.md

## Setup

- Node.js 22+, npm 11+. CI uses `npm ci`.
- Copy `.env.example` → `.env`. For E2E, `.env.test` sets `VITE_DISABLE_AUTH=true` to bypass login.
- `VITE_LANDSLIDE_API_URL` (optional, defaults to `http://localhost:8000`) — used by `src/lib/landslideModel.ts`.
- Backend deps: `pip install -r bahuraksha-api/requirements.txt`.

## Commands

```bash
npm run dev                  # Dev server on http://localhost:8080
npm run build                # Production build
npm run build:dev            # Build --mode development
npm run preview              # Preview production build
npm run lint                 # ESLint (ts, tsx)
npm run format               # prettier --write . (full repo)
npm run test                 # Vitest (jsdom, src/**/*.{test,spec}.{ts,tsx})
npm run test:watch           # Vitest watch
npm run e2e                  # Playwright E2E
npm run test:all             # Unit + E2E
npm run playwright:install   # Playwright browsers
npm run ingest:satellite     # Sentinel STAC ingestion (needs SUPABASE_URL + SUPABASE_SERVICE_KEY)
npm run ingest:rainfall      # Open-Meteo rainfall forecast ingestion
npm run ingest:river-levels  # Open-Meteo Flood API river discharge → level ingestion
npm run ingest:flood-predictions  # bahuraksha.onrender.com → flood_predictions table
npm run ingest:landslide-predictions  # ml-pipeline model → landslide_predictions table
start-demo.bat               # Start API (:8000) + frontend (:8080)
demo-check.bat               # Health check: API, frontend, models, CSVs, predictions

# Backend (bahuraksha-api)
cd bahuraksha-api
uvicorn main:app --reload --port 8000
python train_flood_model.py
python train_landslide_model.py
python precompute_snapshots.py

# Backend tests
python -m pytest test_main.py test_integration.py test_training.py test_landslide_training.py -v

# ML pipeline (ml-pipeline)
cd ml-pipeline
python train.py
python train.py --data-path data/landslide_inventory_enriched.csv --no-synthetic  # real ICIMOD data
python evaluate.py
python api_server.py
pytest tests/ -v

# Generate & persist predictions to Supabase (needs SUPABASE_URL + SUPABASE_SERVICE_KEY)
python ../scripts/generate-landslide-predictions.py
```

## Architecture

### Two Python backends

| Directory | Purpose | Stack | Deploy |
|---|---|---|---|
| `ml-pipeline/` | Landslide susceptibility | XGBoost + isotonic, FastAPI :8000 | Docker (`docker compose up`) |
| `bahuraksha-api/` | Unified flood + landslide prediction | rasterio + XGBoost, FastAPI | Render (port 10000) |

Port 8000 conflict between them — run separately or change one.

### Frontend API clients

- **Flood/satellite**: `src/lib/bahuraksha-api.ts` → `https://bahuraksha.onrender.com` (falls back to mock on failure)
- **Landslide ML**: `src/lib/landslideModel.ts` → `VITE_LANDSLIDE_API_URL` (default `http://localhost:8000`, falls back to `computeHeuristicPrediction()` on failure)
- **HEC-RAS**: `src/lib/hecrasModel.ts` → `fetchSyntheticRoutingResults()` uses rational method Q = C·I·A/3.6 + Manning's equation for depth/velocity at 5 cross sections. No API call — runs entirely client-side.

### Key source layout

- **Entry**: `index.html` → `src/main.tsx` → `src/App.tsx`
- **Routing**: React Router (`BrowserRouter` in `src/App.tsx`), NOT TanStack Router. Paths: `/`, `/login`, `/blog`, `/disasters`, `/risk-map`, `/monitoring`, `/landslides` are public; all others need auth via `ProtectedRoute`.
- **Sidebar**: 10 nav items in `AppSidebar.tsx`. Items: Dashboard, Flood Detection, Risk Map, River Monitoring, Landslide Prediction, Alerts, Citizen Reports, Data Sources, About, User Management.
- **Auth**: Custom `AuthProvider` + `ProtectedRoute` in `src/components/auth/`.
- **Data layer**: All Supabase queries in `src/lib/operationalData.ts`. Falls back to empty arrays when DB is empty.
- **State**: TanStack Query (5min stale time, retry: 2, no refetch on window focus).
- **UI**: shadcn/ui (new-york style), `src/components/ui/`, toast via `sonner`.
- **Maps**: React Leaflet (`RiskMap.tsx` flood, `LandslideMap.tsx` landslide ML). `RiskMap.tsx` uses `zonePolygons.ts` for GeoJSON zone boundaries.
- **HEC-RAS**: `hecrasModel.ts` has 5 cross sections (Sundarijal, Gokarna, Pashupati, Teku, Chovar) with Manning's n and a synthetic routing function. Activated in `HecRasModelPanel.tsx`, `RiskMap.tsx`, `Index.tsx`, `RiskMapPage.tsx`, `ZoneRiskTable.tsx` — all pass `hecRasResults` to `computeCompositeRiskZones()` which applies 10% weight.
- **Pages**: Lazy-loaded with framer-motion `PageTransition` wrapper.
- **Skeletons**: `PageSkeleton` with 5 layout variants (dashboard, map, list, detail, default).
- **Error boundaries**: `PageErrorBoundary` wraps every route in `App.tsx`.

### Backend endpoints (bahuraksha-api)

All rate-limited via `slowapi` (env `BAHURAKSHA_RATE_LIMIT`, default `30/min`). Optional API key via `BAHURAKSHA_API_KEY` env + `X-API-Key` header. In-memory cache on `/risk/zones/live` (TTL: `BAHURAKSHA_CACHE_TTL`, default 300s). Request-ID + response-time headers on all responses.

| Method | Path | Rate limit | Description |
|---|---|---|---|
| GET | `/` | 60/min | Root status |
| GET | `/health` | 60/min | Health check |
| GET | `/ready` | 60/min | Readiness (503 if models missing) |
| GET | `/version` | 60/min | Model versions + thresholds |
| POST | `/predict/flood` | 20/min | Flood probability |
| POST | `/predict/landslide` | 20/min | Landslide probability |
| GET | `/risk/zones` | 30/min | Composite risk from query params |
| GET | `/risk/zones/live` | 20/min | Live zone risk from CSV (cached) |
| POST | `/ingest/satellite` | 5/min | Append satellite log row |
| POST | `/debug/features` | 10/min | STAC debug feature vector |
| GET | `/debug` | 10/min | Server debug |
| GET | `/debug/info` | 10/min | Data freshness, cache, file sizes |

## Testing

- **E2E** (Playwright): Uses `npx vite build --mode test && npx vite preview --port 8080` (production build + preview, NOT dev server — Vite dev is too slow at 3555 modules). WebServer timeout: 180s. `reuseExistingServer: !process.env.CI`.
- **E2E auth**: Env `PLAYWRIGHT_DISABLE_AUTH` checked. Set `PLAYWRIGHT_AUTH_EMAIL` + `PLAYWRIGHT_AUTH_PASSWORD` for auth-required runs.
- **E2E navigation**: Prefer `waitUntil: "commit"` for speed with production build.
- **E2E fixture**: `playwright-fixture.ts` at root is a passthrough re-export. Tests import from `@playwright/test`.
- **Vitest**: `@vitejs/plugin-react` (not react-swc). Setup: `src/test/setup.ts` (matchMedia polyfill).
- **Backend tests**: 4 test files (`test_main.py`, `test_integration.py`, `test_training.py`, `test_landslide_training.py`). Integration tests need `httpx`.
- **CI (`.github/workflows/ci.yml`)**: 7 parallel jobs. Order: lint, typecheck, test, backend-test, train-check all independent; build depends on lint+typecheck+test; e2e depends on build. Train-check also runs `precompute_snapshots.py`.

## RBAC

Five roles in `src/lib/permissions.ts`: `admin` (full + `/admin/users`), `ops` (alerts, reports), `analyst` (monitoring + data sources), `field` (submit reports), `viewer` (read-only). Roles stored in `profiles.role` (Supabase DB trigger defaults to `viewer`). `ProtectedRoute` accepts optional `allowedRoles` prop; auto-checks `routeToPermission()`. RLS in `supabase/migrations/20260528000000_add_rls_directives.sql`.

```bash
# Apply Supabase migrations:
npx supabase migration up

# Set first admin:
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

## Conventions

- **Path alias**: `@/` → `src/` (vite.config.ts + tsconfig.json).
- **TypeScript**: strict mode in root tsconfig, but `noUnusedLocals`/`noUnusedParameters` disabled. `no-explicit-any` and `no-unused-vars` ESLint rules are off.
- **Typecheck**: `npx tsc --noEmit` (root `tsconfig.json`).
- **React 19** with lazy-loaded pages and framer-motion transitions.
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin. No postcss.config.js needed.
- **Prettier**: 100 char width, trailing commas, double quotes.
- **shadcn/ui**: new-york style, `lucide-react` icons, `components.json` at root.

## Supabase

- Client: `src/integrations/supabase/client.ts`
- Types: `src/integrations/supabase/types.ts` (auto-generated; `profiles` type manually added)
- Migrations: `supabase/migrations/` (10 migrations)
- Tables: `risk_zones`, `river_stations`, `river_level_observations`, `rainfall_forecasts`, `data_sources`, `satellite_products`, `profiles`, `sentinel_scenes`, `landslide_predictions`, `flood_predictions`

## Docker & Deploy

- **bahuraksha-api Dockerfile**: `python:3.11-slim`, uvicorn on 8000. Build: `docker build -t bahuraksha-api ./bahuraksha-api && docker run -p 8000:8000 bahuraksha-api`.
- **ml-pipeline Dockerfile**: Also port 8000 (conflict — run separately or remap).
- **docker-compose.yml**: ml-pipeline only (API not included). Profiles: default (API), `--profile train`, `--profile evaluate`, `--profile test`.
- **Render** (`render.yaml`): Python native (not Docker). Start: `uvicorn main:app --host 0.0.0.0 --port 10000`.
- **CI builds the frontend** via `vite build` (no Docker build in CI).
