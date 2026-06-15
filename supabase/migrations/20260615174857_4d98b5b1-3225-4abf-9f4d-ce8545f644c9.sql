ALTER TABLE public.redactor_proxy_keys ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.redactor_proxy_keys ADD COLUMN IF NOT EXISTS monthly_cap_usd INT;

CREATE TABLE IF NOT EXISTS public.redactor_model_pricing (
  model_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  cost_input NUMERIC(10,4) NOT NULL,
  cost_output NUMERIC(10,4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.redactor_model_pricing TO authenticated;
GRANT ALL ON public.redactor_model_pricing TO service_role;

ALTER TABLE public.redactor_model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only — model pricing"
  ON public.redactor_model_pricing
  FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE public.redactor_request_logs ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,6);