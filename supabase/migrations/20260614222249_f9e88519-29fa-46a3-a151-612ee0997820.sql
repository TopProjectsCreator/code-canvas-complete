
CREATE TABLE IF NOT EXISTS public.redactor_provider_keys (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  base_url TEXT,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redactor_provider_keys_user ON public.redactor_provider_keys(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redactor_provider_keys TO authenticated;
GRANT ALL ON public.redactor_provider_keys TO service_role;
ALTER TABLE public.redactor_provider_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their provider keys" ON public.redactor_provider_keys
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.redactor_proxy_keys (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  allowed_providers TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_rpm INT,
  log_requests BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redactor_proxy_keys_user ON public.redactor_proxy_keys(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redactor_proxy_keys TO authenticated;
GRANT ALL ON public.redactor_proxy_keys TO service_role;
ALTER TABLE public.redactor_proxy_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their proxy keys" ON public.redactor_proxy_keys
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.redactor_redaction_rules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redactor_rules_user ON public.redactor_redaction_rules(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redactor_redaction_rules TO authenticated;
GRANT ALL ON public.redactor_redaction_rules TO service_role;
ALTER TABLE public.redactor_redaction_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their redaction rules" ON public.redactor_redaction_rules
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.redactor_request_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proxy_key_id TEXT REFERENCES public.redactor_proxy_keys(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  status INT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  redactions JSONB,
  latency_ms INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redactor_logs_user_created ON public.redactor_request_logs(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.redactor_request_logs TO authenticated;
GRANT ALL ON public.redactor_request_logs TO service_role;
ALTER TABLE public.redactor_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their request logs" ON public.redactor_request_logs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.redactor_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
GRANT ALL ON public.redactor_secrets TO service_role;
ALTER TABLE public.redactor_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only — select" ON public.redactor_secrets
  FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "service role only — insert" ON public.redactor_secrets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service role only — delete" ON public.redactor_secrets
  FOR DELETE USING (auth.role() = 'service_role');

INSERT INTO public.redactor_secrets (key, value)
VALUES ('master_encryption_key', 'IIemMaxb9NJ05QnLy34GMkdFXZSbeyzvdk544zzPZsQ=')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.redactor_secrets (key, value)
VALUES ('internal_secret', 'Xv9bApvVKEHHErmKS4yq+67Qrlku6guF')
ON CONFLICT (key) DO NOTHING;
