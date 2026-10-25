ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS folder_names text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public.project_folder_names(_files jsonb) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT coalesce(array_agg(DISTINCT folder ORDER BY folder), '{}'::text[]) FROM (
 SELECT CASE WHEN node->>'type' = 'folder' THEN node->>'name'
 ELSE CASE WHEN position('/' in trim(both '/' from node->>'name')) > 0 THEN split_part(trim(both '/' from node->>'name'), '/', 1) ELSE 'Root' END END AS folder
 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_files) = 'array' THEN _files ELSE '[]'::jsonb END) node
 ) names WHERE folder IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.update_project_folder_names() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.folder_names := public.project_folder_names(NEW.files); RETURN NEW; END;
$$;
CREATE TRIGGER projects_folder_summary BEFORE INSERT OR UPDATE OF files, folder_names ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_project_folder_names();
UPDATE public.projects SET folder_names = public.project_folder_names(files);
CREATE INDEX IF NOT EXISTS projects_user_updated_list_idx ON public.projects (user_id, updated_at DESC, id);
REVOKE ALL ON FUNCTION public.update_project_folder_names() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.project_folder_names(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_folder_names(jsonb) TO authenticated, service_role;
