DROP VIEW IF EXISTS public.oauth_apps_public;
CREATE VIEW public.oauth_apps_public
WITH (security_invoker = true) AS
  SELECT host, app_name, logo_url, public_description, created_at
  FROM public.allowed_oauth_return_hosts
  WHERE status = 'approved';

GRANT SELECT ON public.oauth_apps_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read approved oauth hosts" ON public.allowed_oauth_return_hosts;
CREATE POLICY "Anyone can read approved oauth hosts"
  ON public.allowed_oauth_return_hosts FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Users can update own comments" ON public.code_comments;
CREATE POLICY "Users can update own comments"
  ON public.code_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = code_comments.project_id AND user_id = auth.uid() AND accepted = true)
    )
  );