-- Fix 1: Restrict project_stars SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can view all stars" ON public.project_stars;
CREATE POLICY "Authenticated users can view stars"
ON public.project_stars FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix 2: Fix is_team_member to require accepted = true
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND accepted = true
  )
$$;

-- Fix 3: Add trigger context guard to handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP != 'INSERT' OR TG_TABLE_NAME != 'users' THEN
    RAISE EXCEPTION 'Unauthorized function call';
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;