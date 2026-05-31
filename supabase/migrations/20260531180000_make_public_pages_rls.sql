-- Make hazard monitoring data publicly readable (SELECT)
-- These are non-sensitive hazard data needed by public-facing pages:
--   /risk-map, /monitoring, /landslides
-- INSERT/UPDATE/DELETE remain restricted to authenticated users.

-- risk_zones: zone boundaries, risk levels, coordinates
DROP POLICY IF EXISTS "risk_zones_select_policy" ON public.risk_zones;
CREATE POLICY "risk_zones_select_policy" ON public.risk_zones
  FOR SELECT USING (true);

-- river_stations: station names, locations, water levels
DROP POLICY IF EXISTS "river_stations_select_policy" ON public.river_stations;
CREATE POLICY "river_stations_select_policy" ON public.river_stations
  FOR SELECT USING (true);

-- river_level_observations: historical and real-time water level readings
DROP POLICY IF EXISTS "river_level_observations_select_policy" ON public.river_level_observations;
CREATE POLICY "river_level_observations_select_policy" ON public.river_level_observations
  FOR SELECT USING (true);

-- rainfall_forecasts: precipitation forecasts from Open-Meteo
DROP POLICY IF EXISTS "rainfall_forecasts_select_policy" ON public.rainfall_forecasts;
CREATE POLICY "rainfall_forecasts_select_policy" ON public.rainfall_forecasts
  FOR SELECT USING (true);

-- data_sources: metadata about data sources (names, descriptions, update schedules)
DROP POLICY IF EXISTS "data_sources_select_policy" ON public.data_sources;
CREATE POLICY "data_sources_select_policy" ON public.data_sources
  FOR SELECT USING (true);
