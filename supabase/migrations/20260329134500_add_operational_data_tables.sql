CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'offline')),
  description TEXT NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Data sources are publicly readable"
  ON public.data_sources
  FOR SELECT
  USING (true);

CREATE TABLE public.risk_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'watch', 'warning', 'evacuate')),
  flood_probability DOUBLE PRECISION NOT NULL CHECK (flood_probability >= 0 AND flood_probability <= 1),
  landslide_probability DOUBLE PRECISION NOT NULL CHECK (landslide_probability >= 0 AND landslide_probability <= 1),
  population INTEGER NOT NULL DEFAULT 0,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Risk zones are publicly readable"
  ON public.risk_zones
  FOR SELECT
  USING (true);

CREATE TABLE public.river_stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  current_level DOUBLE PRECISION NOT NULL,
  danger_level DOUBLE PRECISION NOT NULL,
  warning_level DOUBLE PRECISION NOT NULL,
  trend TEXT NOT NULL CHECK (trend IN ('rising', 'falling', 'stable')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'watch', 'warning', 'evacuate')),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'seed'
);

ALTER TABLE public.river_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "River stations are publicly readable"
  ON public.river_stations
  FOR SELECT
  USING (true);

CREATE TABLE public.river_level_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID NOT NULL REFERENCES public.river_stations(id) ON DELETE CASCADE,
  observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_level DOUBLE PRECISION,
  predicted_level DOUBLE PRECISION,
  danger_level DOUBLE PRECISION NOT NULL,
  warning_level DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX river_level_observations_station_time_idx
  ON public.river_level_observations (station_id, observed_at DESC);

ALTER TABLE public.river_level_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "River level observations are publicly readable"
  ON public.river_level_observations
  FOR SELECT
  USING (true);

CREATE TABLE public.rainfall_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  basin TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  rainfall_mm DOUBLE PRECISION NOT NULL,
  probability DOUBLE PRECISION NOT NULL CHECK (probability >= 0 AND probability <= 1),
  model TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (basin, forecast_date, model)
);

ALTER TABLE public.rainfall_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rainfall forecasts are publicly readable"
  ON public.rainfall_forecasts
  FOR SELECT
  USING (true);

CREATE TABLE public.satellite_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_slug TEXT NOT NULL,
  product_type TEXT NOT NULL,
  region_name TEXT NOT NULL,
  observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  risk_level TEXT CHECK (risk_level IN ('safe', 'watch', 'warning', 'evacuate')),
  flood_area_km2 DOUBLE PRECISION,
  cloud_cover DOUBLE PRECISION,
  resolution_meters DOUBLE PRECISION,
  footprint_geojson JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_url TEXT,
  thumbnail_url TEXT,
  is_latest BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX satellite_products_latest_idx
  ON public.satellite_products (source_slug, product_type, observed_at DESC);

ALTER TABLE public.satellite_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Satellite products are publicly readable"
  ON public.satellite_products
  FOR SELECT
  USING (true);

INSERT INTO public.data_sources (slug, name, provider, category, status, description, last_updated, metadata)
VALUES
  ('sentinel-1-sar', 'Sentinel-1 SAR', 'Copernicus', 'satellite', 'active', 'Synthetic Aperture Radar for flood extent and water detection.', now() - interval '2 hours', '{"product_type":"flood_extent","collection":"sentinel-1-grd"}'),
  ('sentinel-2-optical', 'Sentinel-2 Optical', 'Copernicus', 'satellite', 'active', 'Optical multispectral imagery for water, land cover, and glacial observations.', now() - interval '5 hours', '{"product_type":"surface_reflectance","collection":"sentinel-2-l2a"}'),
  ('gfs-forecast', 'Rainfall Forecast', 'NOAA GFS', 'weather', 'active', 'Weather-driven rainfall forecast for Bagmati Basin.', now() - interval '30 minutes', '{"model":"GFS"}'),
  ('dhm-river-gauges', 'River Gauges', 'DHM Nepal', 'hydrology', 'active', 'Telemetry from river gauge stations.', now() - interval '15 minutes', '{"network":"Bagmati","active_sensors":23,"total_sensors":25}'),
  ('citizen-reports', 'Citizen Reports', 'Community', 'ground-truth', 'active', 'Field observations submitted by citizens.', now() - interval '10 minutes', '{"verification":"manual+ml"}'),
  ('bahuraksha-risk-engine', 'Risk Engine', 'Bahuraksha', 'ml', 'active', 'Composite flood and landslide risk scoring.', now() - interval '10 minutes', '{"models":["lstm","xgboost"]}');

INSERT INTO public.risk_zones (name, district, risk_level, flood_probability, landslide_probability, population, center_lat, center_lng, source)
VALUES
  ('Kathmandu Metro', 'Kathmandu', 'warning', 0.72, 0.15, 1442271, 27.7172, 85.3240, 'seed'),
  ('Lalitpur Sub-Metro', 'Lalitpur', 'watch', 0.45, 0.30, 284922, 27.6588, 85.3247, 'seed'),
  ('Bhaktapur Municipality', 'Bhaktapur', 'safe', 0.12, 0.08, 81748, 27.6710, 85.4298, 'seed'),
  ('Kirtipur Municipality', 'Kathmandu', 'evacuate', 0.88, 0.22, 65602, 27.6783, 85.2775, 'seed'),
  ('Budhanilkantha', 'Kathmandu', 'watch', 0.35, 0.55, 97042, 27.7800, 85.3600, 'seed'),
  ('Tokha Municipality', 'Kathmandu', 'warning', 0.62, 0.40, 126286, 27.7500, 85.3100, 'seed');

INSERT INTO public.river_stations (name, location_lat, location_lng, current_level, danger_level, warning_level, trend, risk_level, last_updated, source)
VALUES
  ('Chovar Station', 27.6600, 85.2900, 4.2, 5.5, 4.8, 'rising', 'watch', now() - interval '15 minutes', 'seed'),
  ('Sundarijal Station', 27.7700, 85.4200, 3.1, 4.5, 3.8, 'stable', 'safe', now() - interval '20 minutes', 'seed'),
  ('Gokarna Station', 27.7300, 85.3700, 5.1, 5.5, 4.8, 'rising', 'warning', now() - interval '17 minutes', 'seed'),
  ('Teku Station', 27.6950, 85.3050, 5.8, 5.5, 4.8, 'rising', 'evacuate', now() - interval '13 minutes', 'seed'),
  ('Pashupati Station', 27.7100, 85.3500, 4.5, 5.5, 4.8, 'rising', 'watch', now() - interval '25 minutes', 'seed');

WITH teku_station AS (
  SELECT id FROM public.river_stations WHERE name = 'Teku Station'
)
INSERT INTO public.river_level_observations (station_id, observed_at, actual_level, predicted_level, danger_level, warning_level, source)
SELECT
  teku_station.id,
  now() - make_interval(hours => 47 - series.i),
  CASE
    WHEN series.i <= 24 THEN 3.5 + sin(series.i / 6.0) * 0.8 + CASE WHEN series.i > 12 THEN (series.i - 12) * 0.08 ELSE 0 END
    ELSE NULL
  END,
  3.5 + sin(series.i / 6.0) * 0.8 + CASE WHEN series.i > 12 THEN (series.i - 12) * 0.08 ELSE 0 END,
  5.5,
  4.8,
  'seed'
FROM teku_station
CROSS JOIN generate_series(0, 47) AS series(i);

INSERT INTO public.rainfall_forecasts (basin, forecast_date, rainfall_mm, probability, model, source)
VALUES
  ('Bagmati Basin', CURRENT_DATE, 25, 0.60, 'GFS', 'seed'),
  ('Bagmati Basin', CURRENT_DATE + 1, 42, 0.75, 'GFS', 'seed'),
  ('Bagmati Basin', CURRENT_DATE + 2, 68, 0.90, 'GFS', 'seed'),
  ('Bagmati Basin', CURRENT_DATE + 3, 85, 0.95, 'GFS', 'seed'),
  ('Bagmati Basin', CURRENT_DATE + 4, 55, 0.70, 'GFS', 'seed'),
  ('Bagmati Basin', CURRENT_DATE + 5, 30, 0.50, 'GFS', 'seed'),
  ('Bagmati Basin', CURRENT_DATE + 6, 15, 0.30, 'GFS', 'seed');

INSERT INTO public.satellite_products (
  source_slug,
  product_type,
  region_name,
  observed_at,
  risk_level,
  flood_area_km2,
  cloud_cover,
  resolution_meters,
  footprint_geojson,
  metadata,
  product_url,
  thumbnail_url,
  is_latest
)
VALUES
  (
    'sentinel-1-sar',
    'flood_extent',
    'Bagmati Basin',
    now() - interval '2 hours',
    'warning',
    18.4,
    0,
    10,
    '{"type":"Feature","properties":{"name":"Bagmati flood extent"},"geometry":{"type":"Polygon","coordinates":[[[85.257,27.676],[85.335,27.676],[85.335,27.728],[85.257,27.728],[85.257,27.676]]]}}'::jsonb,
    '{"platform":"Sentinel-1","orbit":"descending","polarisation":"VV/VH"}'::jsonb,
    'https://pzofgoiaittsmlqaeexg.supabase.co/storage/v1/object/public/satellite/flood_extent_latest.geojson',
    NULL,
    true
  ),
  (
    'sentinel-2-optical',
    'water_mask',
    'Bagmati Basin',
    now() - interval '5 hours',
    'watch',
    16.1,
    12.5,
    10,
    '{"type":"Feature","properties":{"name":"Bagmati water mask"},"geometry":{"type":"Polygon","coordinates":[[[85.285,27.69],[85.35,27.69],[85.35,27.742],[85.285,27.742],[85.285,27.69]]]}}'::jsonb,
    '{"platform":"Sentinel-2","tile":"T45RVM","bands":["B03","B08","B11"]}'::jsonb,
    NULL,
    NULL,
    true
  );
