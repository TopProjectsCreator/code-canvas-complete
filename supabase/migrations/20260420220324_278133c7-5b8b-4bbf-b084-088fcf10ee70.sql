CREATE OR REPLACE FUNCTION public.get_total_canvases_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.projects;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_canvases_count() TO anon, authenticated;