
-- Table to store user-provided API keys (encrypted at rest by Supabase)
CREATE TABLE public.user_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API keys" ON public.user_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own API keys" ON public.user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own API keys" ON public.user_api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own API keys" ON public.user_api_keys FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON public.user_api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table to track daily AI usage per user per model tier
CREATE TABLE public.ai_usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  model_tier TEXT NOT NULL, -- 'pro', 'flash', 'lite'
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, model_tier, usage_date)
);

ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" ON public.ai_usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage usage" ON public.ai_usage_tracking FOR ALL USING (true);
