
-- Fix infinite recursion: team_members SELECT policy references itself
-- Create a security definer function to check team membership

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND owner_id = _user_id
  )
$$;

-- Fix teams table: replace recursive SELECT policy
DROP POLICY IF EXISTS "Team members can view team" ON public.teams;
CREATE POLICY "Team members can view team" ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), id));

-- Fix team_members table: replace recursive SELECT policy
DROP POLICY IF EXISTS "Members can view team members" ON public.team_members;
CREATE POLICY "Members can view team members" ON public.team_members
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- Fix team_policies
DROP POLICY IF EXISTS "Members can view policies" ON public.team_policies;
CREATE POLICY "Members can view policies" ON public.team_policies
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- Fix team_forms
DROP POLICY IF EXISTS "Members can view forms" ON public.team_forms;
CREATE POLICY "Members can view forms" ON public.team_forms
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- Fix team_custom_templates
DROP POLICY IF EXISTS "Members can view templates" ON public.team_custom_templates;
CREATE POLICY "Members can view templates" ON public.team_custom_templates
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- Fix team owner policies to use security definer function too
DROP POLICY IF EXISTS "Team owners can manage teams" ON public.teams;
CREATE POLICY "Team owners can manage teams" ON public.teams
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Team owners can manage members" ON public.team_members;
CREATE POLICY "Team owners can manage members" ON public.team_members
  FOR ALL TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can manage policies" ON public.team_policies;
CREATE POLICY "Team owners can manage policies" ON public.team_policies
  FOR ALL TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can manage forms" ON public.team_forms;
CREATE POLICY "Team owners can manage forms" ON public.team_forms
  FOR ALL TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can manage templates" ON public.team_custom_templates;
CREATE POLICY "Team owners can manage templates" ON public.team_custom_templates
  FOR ALL TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team owners can manage spending" ON public.team_spending;
CREATE POLICY "Team owners can manage spending" ON public.team_spending
  FOR ALL TO authenticated
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));
