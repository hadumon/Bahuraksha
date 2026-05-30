-- Remove 'glof' from alerts type CHECK constraint
-- GLOF monitoring feature has been removed from the frontend

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_type_check;

ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check
  CHECK (type IN ('flood', 'landslide'));
