
CREATE TABLE public.thread_whiteboards (
  thread_id uuid NOT NULL PRIMARY KEY REFERENCES public.threads(id) ON DELETE CASCADE,
  scene jsonb NOT NULL DEFAULT '{"elements":[],"appState":{}}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.thread_whiteboards TO anon, authenticated;
GRANT INSERT, UPDATE ON public.thread_whiteboards TO authenticated;
GRANT ALL ON public.thread_whiteboards TO service_role;

ALTER TABLE public.thread_whiteboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view thread whiteboards"
  ON public.thread_whiteboards FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can create thread whiteboards"
  ON public.thread_whiteboards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = updated_by);

CREATE POLICY "Authenticated can update thread whiteboards"
  ON public.thread_whiteboards FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = updated_by);

CREATE TRIGGER update_thread_whiteboards_updated_at
  BEFORE UPDATE ON public.thread_whiteboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_whiteboards;
ALTER TABLE public.thread_whiteboards REPLICA IDENTITY FULL;
