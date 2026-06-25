-- Redactor final fix: seed secrets, ensure RLS policies on redactor_secrets,
-- and set default UUID for request_logs id.
-- Safe to run multiple times (all use IF NOT EXISTS / ON CONFLICT DO NOTHING).

INSERT INTO redactor_secrets (key, value)
VALUES ('master_encryption_key', 'IIemMaxb9NJ05QnLy34GMkdFXZSbeyzvdk544zzPZsQ=')
ON CONFLICT (key) DO NOTHING;

INSERT INTO redactor_secrets (key, value)
VALUES ('internal_secret', 'Xv9bApvVKEHHErmKS4yq+67Qrlku6guF')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE redactor_request_logs
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

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
