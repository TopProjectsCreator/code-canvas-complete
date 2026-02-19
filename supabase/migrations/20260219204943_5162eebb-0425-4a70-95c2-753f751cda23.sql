
-- Fix the overly permissive policy - replace with specific user-scoped policies
DROP POLICY "Service can manage usage" ON public.ai_usage_tracking;

CREATE POLICY "Users can insert their own usage" ON public.ai_usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own usage" ON public.ai_usage_tracking FOR UPDATE USING (auth.uid() = user_id);
