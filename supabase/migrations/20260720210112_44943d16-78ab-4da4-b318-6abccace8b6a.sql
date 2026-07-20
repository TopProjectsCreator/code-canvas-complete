CREATE TABLE public.global_whiteboard (
  id TEXT PRIMARY KEY,
  scene JSONB NOT NULL DEFAULT '{"elements":[],"appState":{"viewBackgroundColor":"#ffffff"}}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.global_whiteboard TO anon;
GRANT SELECT, INSERT, UPDATE ON public.global_whiteboard TO authenticated;
GRANT ALL ON public.global_whiteboard TO service_role;

ALTER TABLE public.global_whiteboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global whiteboard"
  ON public.global_whiteboard FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert global whiteboard"
  ON public.global_whiteboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update global whiteboard"
  ON public.global_whiteboard FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

INSERT INTO public.global_whiteboard (id) VALUES ('threads') ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.global_whiteboard;
