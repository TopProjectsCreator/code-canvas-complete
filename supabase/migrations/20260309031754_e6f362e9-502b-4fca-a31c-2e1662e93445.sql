
-- MCP servers configured by users
CREATE TABLE public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  api_key TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own MCP servers"
  ON public.mcp_servers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Agent skills/custom instructions
CREATE TABLE public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instruction TEXT NOT NULL,
  icon TEXT DEFAULT 'sparkles',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own agent skills"
  ON public.agent_skills FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_skills_updated_at
  BEFORE UPDATE ON public.agent_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
