-- Redactor secrets (encryption keys, internal tokens)
-- Read by Edge Functions when env vars are unavailable.

CREATE TABLE IF NOT EXISTS redactor_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE redactor_secrets ENABLE ROW LEVEL SECURITY;

-- Only service-role (Edge Functions) can read/write secrets
CREATE POLICY "service role only — select" ON redactor_secrets
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "service role only — insert/update" ON redactor_secrets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service role only — delete" ON redactor_secrets
  FOR DELETE USING (auth.role() = 'service_role');

-- Master encryption key for AES-256-GCM provider key encryption
-- Must be exactly 32 random bytes, base64-encoded.
INSERT INTO redactor_secrets (key, value)
VALUES ('master_encryption_key', 'IIemMaxb9NJ05QnLy34GMkdFXZSbeyzvdk544zzPZsQ=')
ON CONFLICT (key) DO NOTHING;

-- Internal shared secret for trusted inter-function calls (proxy → crypto)
INSERT INTO redactor_secrets (key, value)
VALUES ('internal_secret', 'Xv9bApvVKEHHErmKS4yq+67Qrlku6guF')
ON CONFLICT (key) DO NOTHING;

-- Give request_logs a default UUID so Edge Functions don't need nanoid
ALTER TABLE redactor_request_logs
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
