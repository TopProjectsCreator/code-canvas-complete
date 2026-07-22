-- Redactor — Model Router tables
-- Each user can create named routers with ordered fallback steps.

CREATE TABLE IF NOT EXISTS redactor_model_routers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fallback_on TEXT NOT NULL DEFAULT 'all',
  fallback_status_codes INT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redactor_routers_user ON redactor_model_routers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_redactor_routers_user_name ON redactor_model_routers(user_id, name);
ALTER TABLE redactor_model_routers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their routers" ON redactor_model_routers FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS redactor_router_steps (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  router_id TEXT NOT NULL REFERENCES redactor_model_routers(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  provider_key_id TEXT REFERENCES redactor_provider_keys(id) ON DELETE SET NULL,
  base_url TEXT,
  encrypted_key TEXT,
  iv TEXT,
  salt TEXT,
  model TEXT NOT NULL,
  api_shape TEXT NOT NULL DEFAULT 'auto',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redactor_router_steps_router ON redactor_router_steps(router_id, step_order);
ALTER TABLE redactor_router_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their router steps" ON redactor_router_steps FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_router_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS router_updated_at ON redactor_model_routers;
CREATE TRIGGER router_updated_at BEFORE UPDATE ON redactor_model_routers FOR EACH ROW EXECUTE FUNCTION update_router_updated_at();