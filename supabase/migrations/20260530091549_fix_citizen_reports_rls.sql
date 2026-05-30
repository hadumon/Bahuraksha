-- Fix citizen_reports SELECT RLS: remove always-true auth.uid() condition
-- that bypassed the role check. Now only admin/ops/field/analyst can read.

DROP POLICY IF EXISTS "citizen_reports_select_policy" ON public.citizen_reports;
CREATE POLICY "citizen_reports_select_policy" ON public.citizen_reports
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND public.current_user_role() IN ('admin', 'ops', 'field', 'analyst')
  );
