-- Adds operational risk assessment persistence, rainfall forecast metadata, and alert automation helpers.

ALTER TABLE public.rainfall_forecasts
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  ADD COLUMN IF NOT EXISTS source_url TEXT;

UPDATE public.rainfall_forecasts
SET
  source = CASE WHEN source = 'seed' THEN 'seed-demo' ELSE source END,
  model = CASE WHEN model = 'GFS' AND source = 'seed-demo' THEN 'seed-demo-seasonal' ELSE model END,
  valid_at = forecast_date::timestamp AT TIME ZONE 'UTC',
  confidence = COALESCE(confidence, probability)
WHERE source IN ('seed', 'seed-demo');

UPDATE public.data_sources
SET
  description = 'Seeded demo risk rows until backend risk assessments are generated.',
  metadata = jsonb_set(metadata, '{note}', '"Not an operational LSTM/XGBoost metric until assessments are persisted."', true)
WHERE slug = 'bahuraksha-risk-engine';

CREATE TABLE IF NOT EXISTS public.risk_zone_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id UUID REFERENCES public.risk_zones(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  assessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  computed_risk_level TEXT NOT NULL CHECK (computed_risk_level IN ('safe', 'watch', 'warning', 'evacuate')),
  composite_score DOUBLE PRECISION NOT NULL CHECK (composite_score >= 0 AND composite_score <= 1),
  computed_flood_probability DOUBLE PRECISION NOT NULL CHECK (computed_flood_probability >= 0 AND computed_flood_probability <= 1),
  data_quality TEXT NOT NULL CHECK (data_quality IN ('low', 'medium', 'high')),
  nearest_station_name TEXT,
  drivers JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'risk-engine'
);

CREATE INDEX IF NOT EXISTS risk_zone_assessments_zone_time_idx
  ON public.risk_zone_assessments (zone_id, assessed_at DESC);

ALTER TABLE public.risk_zone_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'risk_zone_assessments'
      AND policyname = 'Risk zone assessments are publicly readable'
  ) THEN
    CREATE POLICY "Risk zone assessments are publicly readable"
      ON public.risk_zone_assessments
      FOR SELECT
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_risk_alert_from_assessment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.computed_risk_level IN ('warning', 'evacuate') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.alerts
      WHERE is_active = true
        AND type = 'flood'
        AND zone = NEW.zone_name
        AND severity = NEW.computed_risk_level
        AND created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.alerts (type, severity, title, message, zone, is_active)
      VALUES (
        'flood',
        NEW.computed_risk_level,
        CASE
          WHEN NEW.computed_risk_level = 'evacuate' THEN 'CRITICAL: Composite flood risk — ' || NEW.zone_name
          ELSE 'Flood warning — ' || NEW.zone_name
        END,
        'Composite risk engine score ' || round((NEW.composite_score * 100)::numeric, 1) || '%. Review rainfall, gauge, XGBoost, and HEC-RAS drivers before field action.',
        NEW.zone_name,
        true
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS risk_zone_assessment_alert_trigger ON public.risk_zone_assessments;
CREATE TRIGGER risk_zone_assessment_alert_trigger
AFTER INSERT ON public.risk_zone_assessments
FOR EACH ROW
EXECUTE FUNCTION public.create_risk_alert_from_assessment();
