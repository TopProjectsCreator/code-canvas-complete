CREATE TABLE public.allowed_oauth_return_hosts (
  host text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.allowed_oauth_return_hosts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.allowed_oauth_return_hosts TO authenticated;
GRANT ALL ON public.allowed_oauth_return_hosts TO service_role;

ALTER TABLE public.allowed_oauth_return_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read allowed hosts"
  ON public.allowed_oauth_return_hosts
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert allowed hosts"
  ON public.allowed_oauth_return_hosts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update allowed hosts"
  ON public.allowed_oauth_return_hosts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete allowed hosts"
  ON public.allowed_oauth_return_hosts
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_allowed_oauth_return_hosts_updated_at
  BEFORE UPDATE ON public.allowed_oauth_return_hosts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.allowed_oauth_return_hosts (host, note) VALUES
  ('replitclone.lovable.app', 'Lovable bridge / published app'),
  ('codecanvas.app', 'Custom domain'),
  ('www.codecanvas.app', 'Custom domain (www)')
ON CONFLICT (host) DO NOTHING;