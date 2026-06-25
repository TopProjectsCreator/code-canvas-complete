ALTER TABLE redactor_proxy_keys ADD COLUMN IF NOT EXISTS redact_images boolean NOT NULL DEFAULT true;
ALTER TABLE redactor_proxy_keys ADD COLUMN IF NOT EXISTS redact_videos boolean NOT NULL DEFAULT true;
ALTER TABLE redactor_request_logs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

CREATE TABLE IF NOT EXISTS redactor_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE redactor_secrets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'redactor_secrets' AND policyname = 'service role only -- select') THEN
    CREATE POLICY "service role only -- select" ON redactor_secrets
      FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'redactor_secrets' AND policyname = 'service role only -- insert/update') THEN
    CREATE POLICY "service role only -- insert/update" ON redactor_secrets
      FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'redactor_secrets' AND policyname = 'service role only -- delete') THEN
    CREATE POLICY "service role only -- delete" ON redactor_secrets
      FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END $$;

INSERT INTO redactor_secrets (key, value)
VALUES ('master_encryption_key', 'IIemMaxb9NJ05QnLy34GMkdFXZSbeyzvdk544zzPZsQ=')
ON CONFLICT (key) DO NOTHING;

INSERT INTO redactor_secrets (key, value)
VALUES ('internal_secret', 'Xv9bApvVKEHHErmKS4yq+67Qrlku6guF')
ON CONFLICT (key) DO NOTHING;
