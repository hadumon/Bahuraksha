CREATE TABLE IF NOT EXISTS public.sentinel_scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scene_id TEXT NOT NULL UNIQUE,
  collection TEXT NOT NULL,
  use_case TEXT NOT NULL,
  scene_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  cloud_cover DOUBLE PRECISION,
  platform TEXT,
  instrument_mode TEXT,
  polarizations JSONB,
  orbit_state TEXT,
  mgrs_tile TEXT,
  processing_baseline TEXT,
  bbox_west DOUBLE PRECISION NOT NULL,
  bbox_south DOUBLE PRECISION NOT NULL,
  bbox_east DOUBLE PRECISION NOT NULL,
  bbox_north DOUBLE PRECISION NOT NULL,
  geometry JSONB,
  assets_json JSONB,
  stac_item_url TEXT,
  ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentinel_scenes_collection_datetime_idx
  ON public.sentinel_scenes (collection, scene_datetime DESC);

ALTER TABLE public.sentinel_scenes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sentinel_scenes'
      AND policyname = 'Sentinel scenes are publicly readable'
  ) THEN
    CREATE POLICY "Sentinel scenes are publicly readable"
      ON public.sentinel_scenes
      FOR SELECT
      USING (true);
  END IF;
END $$;
