-- Enable RLS on all tables (some may already have it)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.citizen_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.river_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.river_level_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rainfall_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.satellite_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sentinel_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landslide_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.risk_zone_assessments ENABLE ROW LEVEL SECURITY;

-- ─── Helper function to check if the authenticated user has a given role ─────
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = required_role
  );
$$;

-- ─── Helper function to get the authenticated user's role ─────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── Profiles RLS ────────────────────────────────────────────────────────────
-- Users can read their own profile; admins can read all
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid() OR public.has_role('admin')
  );

-- Users can update their own profile (except role); admins can update any profile
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE
  USING (
    id = auth.uid() OR public.has_role('admin')
  )
  WITH CHECK (
    (id = auth.uid() AND role = OLD.role) OR public.has_role('admin')
  );

-- Only admins can insert/delete profiles
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE
  USING (public.has_role('admin'));

-- ─── Alerts RLS ──────────────────────────────────────────────────────────────
-- Everyone authenticated can read alerts
DROP POLICY IF EXISTS "alerts_select_policy" ON public.alerts;
CREATE POLICY "alerts_select_policy" ON public.alerts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- admin + ops can insert/update/delete
DROP POLICY IF EXISTS "alerts_insert_policy" ON public.alerts;
CREATE POLICY "alerts_insert_policy" ON public.alerts
  FOR INSERT
  WITH CHECK (public.has_role('admin') OR public.has_role('ops'));

DROP POLICY IF EXISTS "alerts_update_policy" ON public.alerts;
CREATE POLICY "alerts_update_policy" ON public.alerts
  FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('ops'));

DROP POLICY IF EXISTS "alerts_delete_policy" ON public.alerts;
CREATE POLICY "alerts_delete_policy" ON public.alerts
  FOR DELETE
  USING (public.has_role('admin') OR public.has_role('ops'));

-- ─── Citizen Reports RLS ─────────────────────────────────────────────────────
-- All authenticated can read
DROP POLICY IF EXISTS "citizen_reports_select_policy" ON public.citizen_reports;
CREATE POLICY "citizen_reports_select_policy" ON public.citizen_reports
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      public.current_user_role() IN ('admin', 'ops', 'field', 'analyst')
      OR auth.uid() = (SELECT id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Anyone authenticated can insert (field officers + general users)
DROP POLICY IF EXISTS "citizen_reports_insert_policy" ON public.citizen_reports;
CREATE POLICY "citizen_reports_insert_policy" ON public.citizen_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- admin + ops can update (verify reports)
DROP POLICY IF EXISTS "citizen_reports_update_policy" ON public.citizen_reports;
CREATE POLICY "citizen_reports_update_policy" ON public.citizen_reports
  FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('ops'));

-- ─── Risk Zones, River Stations, Observations, etc. (read-only for all authenticated) ─
-- These are reference/measurement data — everyone authenticated can read, no one writes from frontend
CREATE POLICY IF NOT EXISTS "risk_zones_select_policy" ON public.risk_zones
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "river_stations_select_policy" ON public.river_stations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "river_level_observations_select_policy" ON public.river_level_observations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "rainfall_forecasts_select_policy" ON public.rainfall_forecasts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "data_sources_select_policy" ON public.data_sources
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "satellite_products_select_policy" ON public.satellite_products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "sentinel_scenes_select_policy" ON public.sentinel_scenes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "landslide_predictions_select_policy" ON public.landslide_predictions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "risk_zone_assessments_select_policy" ON public.risk_zone_assessments
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Seed a default admin user (use Supabase dashboard to set email/password) ─
-- INSERT INTO public.profiles (id, email, full_name, role)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin@bahuraksha.gov.np', 'System Admin', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
