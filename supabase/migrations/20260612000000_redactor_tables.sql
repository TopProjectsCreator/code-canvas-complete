-- Redactor — AI gateway tables
-- Each user's data is isolated via RLS policies.

-- Provider keys (encrypted upstream API keys)
CREATE TABLE IF NOT EXISTS redactor_provider_keys (
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

CREATE INDEX IF NOT EXISTS idx_redactor_provider_keys_user
  ON redactor_provider_keys(user_id);

ALTER TABLE redactor_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their provider keys"
  ON redactor_provider_keys
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Proxy keys (hashed, shown once at creation)
CREATE TABLE IF NOT EXISTS redactor_proxy_keys (
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

CREATE INDEX IF NOT EXISTS idx_redactor_proxy_keys_user
  ON redactor_proxy_keys(user_id);

ALTER TABLE redactor_proxy_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their proxy keys"
  ON redactor_proxy_keys
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Custom redaction rules
CREATE TABLE IF NOT EXISTS redactor_redaction_rules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redactor_rules_user
  ON redactor_redaction_rules(user_id);

ALTER TABLE redactor_redaction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their redaction rules"
  ON redactor_redaction_rules
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Request logs (metadata only, no prompt/completion content)
CREATE TABLE IF NOT EXISTS redactor_request_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proxy_key_id TEXT REFERENCES redactor_proxy_keys(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_redactor_logs_user_created
  ON redactor_request_logs(user_id, created_at DESC);

ALTER TABLE redactor_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their request logs"
  ON redactor_request_logs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
