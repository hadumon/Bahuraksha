-- Fix citizen_reports RLS: drop stale policies from original migration.

-- Old "Reports are publicly readable" allowed unauthenticated SELECT (USING true).
-- Old "Anyone can submit reports" allowed unauthenticated INSERT (WITH CHECK true).
-- These were never dropped by the original RLS directives migration.

DROP POLICY IF EXISTS "Reports are publicly readable" ON public.citizen_reports;
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.citizen_reports;
DROP POLICY IF EXISTS "citizen_reports_select_policy" ON public.citizen_reports;

-- Only roles with view:citizen-reports permission can read reports.
CREATE POLICY "citizen_reports_select_policy" ON public.citizen_reports
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_role() IN ('admin', 'ops', 'field', 'analyst')
  );

-- Recreate insert policy for consistency (already correct).
DROP POLICY IF EXISTS "citizen_reports_insert_policy" ON public.citizen_reports;
CREATE POLICY "citizen_reports_insert_policy" ON public.citizen_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Also drop stale "Alerts are publicly readable" policy.
DROP POLICY IF EXISTS "Alerts are publicly readable" ON public.alerts;
