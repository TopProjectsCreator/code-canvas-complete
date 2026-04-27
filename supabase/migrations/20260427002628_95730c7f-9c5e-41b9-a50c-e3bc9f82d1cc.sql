
-- Explicitly deny all write operations on user_roles for authenticated users.
-- The handle_new_user trigger runs as SECURITY DEFINER so it bypasses RLS.

CREATE POLICY "Deny insert on user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny update on user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Deny delete on user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);
