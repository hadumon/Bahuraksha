-- Alert Feedback Loop: delivery tracking, opt-in/out, retry logic

-- ─── 1. Add phone + opt-in columns to profiles ───────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMPTZ;

-- ─── 2. Create alert_recipients table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  twilio_message_sid TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for alert lookup
CREATE INDEX IF NOT EXISTS idx_alert_recipients_alert_id
  ON public.alert_recipients(alert_id);

-- Index for retry queries (pending + retry not exhausted + time has come)
CREATE INDEX IF NOT EXISTS idx_alert_recipients_retry
  ON public.alert_recipients(delivery_status, retry_count, next_retry_at)
  WHERE delivery_status IN ('pending', 'failed');

-- Index for Twilio callback lookup
CREATE INDEX IF NOT EXISTS idx_alert_recipients_twilio_sid
  ON public.alert_recipients(twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

-- ─── 3. Enable RLS ───────────────────────────────────────────────────────
ALTER TABLE public.alert_recipients ENABLE ROW LEVEL SECURITY;

-- admins and ops can read all recipient records
CREATE POLICY "alert_recipients_select_policy"
  ON public.alert_recipients
  FOR SELECT
  USING (public.has_role('admin') OR public.has_role('ops'));

-- service role (backend) inserts recipients
CREATE POLICY "alert_recipients_insert_policy"
  ON public.alert_recipients
  FOR INSERT
  WITH CHECK (public.has_role('admin') OR public.has_role('ops'));

-- service role updates delivery status from Twilio callback
CREATE POLICY "alert_recipients_update_policy"
  ON public.alert_recipients
  FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('ops'));

-- ─── 4. Updated_at trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_alert_recipients_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alert_recipients_updated_at ON public.alert_recipients;
CREATE TRIGGER alert_recipients_updated_at
  BEFORE UPDATE ON public.alert_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_alert_recipients_updated_at();

-- ─── 5. Auto-update whatsapp_opted_in_at when opt-in changes ─────────────
CREATE OR REPLACE FUNCTION public.sync_whatsapp_opt_in_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.whatsapp_opt_in = true AND (OLD.whatsapp_opt_in IS DISTINCT FROM true) THEN
    NEW.whatsapp_opted_in_at = now();
  ELSIF NEW.whatsapp_opt_in = false THEN
    NEW.whatsapp_opted_in_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_whatsapp_opt_in_timestamp ON public.profiles;
CREATE TRIGGER sync_whatsapp_opt_in_timestamp
  BEFORE UPDATE OF whatsapp_opt_in ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_whatsapp_opt_in_timestamp();
