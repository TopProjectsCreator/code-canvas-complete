
CREATE TABLE public.thread_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.thread_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.thread_categories TO authenticated;
GRANT ALL ON public.thread_categories TO service_role;

ALTER TABLE public.thread_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read thread categories"
  ON public.thread_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert thread categories"
  ON public.thread_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update thread categories"
  ON public.thread_categories FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete thread categories"
  ON public.thread_categories FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_thread_categories_updated_at
  BEFORE UPDATE ON public.thread_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.thread_categories (name, sort_order) VALUES
  ('General', 10),
  ('Showcase', 20),
  ('Questions', 30),
  ('Feedback', 40),
  ('Tutorial', 50),
  ('Show & Tell', 60)
ON CONFLICT (name) DO NOTHING;
