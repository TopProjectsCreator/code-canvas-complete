
ALTER TABLE public.allowed_oauth_return_hosts
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS app_name text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS public_description text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

UPDATE public.allowed_oauth_return_hosts SET status = 'approved' WHERE status IS NULL OR status = 'pending';
UPDATE public.allowed_oauth_return_hosts SET app_name = COALESCE(app_name, host);
UPDATE public.allowed_oauth_return_hosts SET admin_notes = COALESCE(admin_notes, note) WHERE note IS NOT NULL;

ALTER TABLE public.allowed_oauth_return_hosts
  ALTER COLUMN app_name SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.allowed_oauth_return_hosts
    ADD CONSTRAINT allowed_oauth_return_hosts_status_check
    CHECK (status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Anyone can read allowed hosts" ON public.allowed_oauth_return_hosts;
DROP POLICY IF EXISTS "Admins can insert allowed hosts" ON public.allowed_oauth_return_hosts;
DROP POLICY IF EXISTS "Admins can update allowed hosts" ON public.allowed_oauth_return_hosts;
DROP POLICY IF EXISTS "Admins can delete allowed hosts" ON public.allowed_oauth_return_hosts;

CREATE POLICY "Admins can view all hosts"
  ON public.allowed_oauth_return_hosts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can view own hosts"
  ON public.allowed_oauth_return_hosts FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can submit host requests"
  ON public.allowed_oauth_return_hosts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can insert any host"
  ON public.allowed_oauth_return_hosts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can update own hosts"
  ON public.allowed_oauth_return_hosts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update any host"
  ON public.allowed_oauth_return_hosts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hosts"
  ON public.allowed_oauth_return_hosts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.protect_oauth_host_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF NEW.host IS DISTINCT FROM OLD.host
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Only admins can change host, status, owner, or admin notes';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS protect_oauth_host_fields_trg ON public.allowed_oauth_return_hosts;
CREATE TRIGGER protect_oauth_host_fields_trg
  BEFORE UPDATE ON public.allowed_oauth_return_hosts
  FOR EACH ROW EXECUTE FUNCTION public.protect_oauth_host_fields();

DROP VIEW IF EXISTS public.oauth_apps_public;
CREATE VIEW public.oauth_apps_public AS
  SELECT host, app_name, logo_url, public_description, created_at
  FROM public.allowed_oauth_return_hosts
  WHERE status = 'approved';

GRANT SELECT ON public.oauth_apps_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_oauth_return_host_allowed(_host text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_oauth_return_hosts
    WHERE host = lower(_host) AND status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_oauth_return_host_allowed(text) TO anon, authenticated;
