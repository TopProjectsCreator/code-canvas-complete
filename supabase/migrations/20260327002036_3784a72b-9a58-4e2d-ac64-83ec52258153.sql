
CREATE OR REPLACE FUNCTION public.increment_extension_installs(ext_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.extensions SET install_count = install_count + 1 WHERE id = ext_id;
$$;

CREATE OR REPLACE FUNCTION public.decrement_extension_installs(ext_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.extensions SET install_count = GREATEST(install_count - 1, 0) WHERE id = ext_id;
$$;
