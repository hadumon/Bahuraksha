# AGENTS.md

## Setup

- Node.js 22+, npm 11+ (CI uses `npm ci`; `bun.lockb` exists but npm is the actual package manager)
- Copy `.env.example` to `.env`. For E2E tests, `.env.test` sets `VITE_DISABLE_AUTH=true` to bypass login.
- `VITE_LANDSLIDE_API_URL` (optional, defaults to `http://localhost:8000`) — used by `src/lib/landslideModel.ts`.

## Commands

```bash
npm run dev              # Dev server on http://localhost:8080
npm run build            # Production build
npm run build:dev        # Build with --mode development
npm run preview          # Preview production build
npm run lint             # ESLint (ts, tsx)
npm run format           # prettier --write . (full repo)
npm run test             # Vitest unit tests (jsdom, src/**/*.{test,spec}.{ts,tsx})
npm run test:watch       # Vitest watch mode
npm run e2e              # Playwright E2E tests
npm run test:all         # Unit + E2E
npm run playwright:install  # Install Playwright browsers
npm run ingest:satellite # Satellite STAC ingestion (needs SUPABASE_URL + SUPABASE_SERVICE_KEY, uses Microsoft Planetary Computer STAC)
npm run ingest:rainfall  # Rainfall data ingestion
```

## Architecture

### Two Python backends

| Directory | Purpose | Stack | Deploy |
|---|---|---|---|
| `ml-pipeline/` | Landslide susceptibility | XGBoost + isotonic, FastAPI on :8000 | Docker (`docker compose up`) |
| `bahuraksha-api/` | Flood detection from Sentinel-1/2 | rasterio + XGBoost, FastAPI | Render (`render.yaml`, port 10000) |

### Frontend API clients

- **Flood/satellite API**: `src/lib/bahuraksha-api.ts` → `https://bahuraksha.onrender.com` (Render, falls back to mock on failure)
- **Landslide ML API**: `src/lib/landslideModel.ts` → `http://localhost:8000` (local/Docker, falls back to heuristic on failure)

### Key source layout

- **Entry**: `index.html` → `src/main.tsx` → `src/App.tsx`
- **Routing**: React Router (`BrowserRouter` in `src/App.tsx`), NOT TanStack Router. `src/routes/` is empty. Paths: `/`, `/login`, `/blog`, `/disasters` are public; all others need auth via `ProtectedRoute`.
- **Auth**: Custom `AuthProvider` + `ProtectedRoute` in `src/components/auth/`.
- **Data layer**: All Supabase queries in `src/lib/operationalData.ts`. Falls back to empty arrays when DB is empty.
- **State**: TanStack Query with 5-min stale time, retry: 2, no refetch on window focus.
- **UI**: shadcn/ui (new-york style), `src/components/ui/`, toast via `sonner`.
- **Maps**: React Leaflet in `src/components/map/`. `RiskMap.tsx` (flood), `LandslideMap.tsx` (landslide ML).
- **Pages**: Lazy-loaded with framer-motion `PageTransition` wrapper.

### Dead dependencies (TanStack Start scaffolding, do not use)

`@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/router-plugin`, `@cloudflare/vite-plugin`, `wrangler.jsonc` exist in package.json but are unused. The app is a plain Vite + React SPA. There is no SSR, no Cloudflare deployment, no TanStack Router file-routing.

### ML Pipeline

```bash
cd ml-pipeline
.\.venv\Scripts\Activate.ps1   # Windows
python train.py                  # Train XGBoost (default: 50k synthetic samples)
python train.py --data-path data/landslide_inventory.csv  # Real data
python evaluate.py               # ROC, PR, confusion matrix → evaluation_report.png
python api_server.py             # FastAPI on :8000 (docs at /docs)
pytest tests/ -v                 # Pipeline tests
```

- **Model**: XGBoost + isotonic calibration, 14 raw + 6 engineered features, CV ROC-AUC ~0.875
- **Risk thresholds**: evacuate (≥0.78), warning (≥0.58), watch (≥0.32), safe (<0.32)
- **Docker profiles**: `docker compose up` (API), `--profile train up`, `--profile evaluate`, `--profile test`

### Satellite Flood API (bahuraksha-api)

```bash
cd bahuraksha-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- Pulls real Sentinel-1 GRD + Sentinel-2 L2A from Earth Search STAC API via rasterio COG reads
- 16 features (6 spectral bands, NDWI/NDSI/NDVI, deltas, VH/VV dB, elevation, slope)
- Predicts: `dry_land` / `flood_water` / `snow_glacier`
- Endpoints: `/predict` (POST), `/latest`, `/history`, `/health`, `/ready`, `/version`, `/debug/features`

## Testing

- **E2E**: Playwright uses `npx vite dev --mode test` (not `npm run dev`) because npm 11 mishandles `--mode` flag. Loads `.env.test` (`VITE_DISABLE_AUTH=true`).
- **E2E auth**: Tests also check `PLAYWRIGHT_DISABLE_AUTH` env var. Set `PLAYWRIGHT_AUTH_EMAIL` + `PLAYWRIGHT_AUTH_PASSWORD` for auth-required E2E runs.
- **E2E webServer**: `reuseExistingServer: !process.env.CI`.
- **E2E navigation**: Use `waitUntil: "commit"` in `page.goto()` — `load` / `domcontentloaded` time out due to Supabase requests.
- **E2E fixture**: `playwright-fixture.ts` exists at root but is a passthrough re-export. Tests import directly from `@playwright/test`.
- **Vitest**: `@vitejs/plugin-react` (not react-swc). Setup: `src/test/setup.ts` (matchMedia polyfill).
- **CI**: Only runs unit tests (`npm run test`), not E2E. Order: lint → typecheck → test (parallel), build depends on all three.

## Conventions

- **Path alias**: `@/` maps to `src/` (vite.config.ts + tsconfig.json).
- **TypeScript**: strict mode in root tsconfig, but `noUnusedLocals`/`noUnusedParameters` disabled in both configs. `no-explicit-any` and `no-unused-vars` ESLint rules are off.
- **Typecheck**: CI runs `npx tsc --noEmit` (uses root `tsconfig.json`).
- **React 19** with lazy-loaded pages and framer-motion transitions.
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin. `postcss.config.js` only has autoprefixer. `tailwind.config.ts` exists but is mostly custom color tokens, not required for v4 to function.
- **Prettier**: 100 char width, trailing commas, double quotes (`.prettierrc`).

## Role-Based Access Control (RBAC)

Five roles defined in `src/lib/permissions.ts`:

| Role | Label | Access |
|---|---|---|
| `admin` | Admin | Full access + user management (`/admin/users`) |
| `ops` | Operator | Operational: alerts, citizen reports, all views |
| `analyst` | Analyst | Monitoring + data sources, no alert/citizen mgmt |
| `field` | Field Officer | Dashboard, risk map, monitoring, submit reports |
| `viewer` | Viewer | Read-only: dashboard, risk map, about |

**Implementation:**
- Roles stored in `profiles.role` column (Supabase auto-creates profile on signup via DB trigger, default `'viewer'`)
- `AuthContext` fetches profile on login → exposes `userRole` and `profile`
- `ProtectedRoute` accepts optional `allowedRoles` prop; also auto-checks `routeToPermission()` per path
- `AppSidebar` filters nav items based on `hasPermission()` per nav item
- `AdminUsersPage` (`/admin/users`) lets admins change roles via a Select dropdown
- RLS policies in `supabase/migrations/20260528000000_add_rls_directives.sql`

## RBAC migration

```bash
# Apply after deploying to Supabase:
npx supabase migration up
```

Then set the first admin's role manually:
```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

## API Key Auth (Backend)

`bahuraksha-api/main.py` supports optional API key auth via `BAHURAKSHA_API_KEY` env var.
- If set, require `X-API-Key` header on all endpoints except `/`, `/health`, `/ready`, `/version`, `/docs`.
- In-memory response cache (TTL: `BAHURAKSHA_CACHE_TTL` env var, default 300s) on `/risk/zones/live`.
- Request-ID logging on all requests.

## Supabase

- Client: `src/integrations/supabase/client.ts`
- Types: `src/integrations/supabase/types.ts` (auto-generated; `profiles` type manually added)
- Migrations: `supabase/migrations/` — apply before expecting live data
- Tables: `risk_zones`, `river_stations`, `river_level_observations`, `rainfall_forecasts`, `data_sources`, `satellite_products`, `profiles`, `sentinel_scenes`, `landslide_predictions`
