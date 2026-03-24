
CREATE TABLE public.parts_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  quantity INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  location_detail TEXT,
  part_number TEXT,
  manufacturer TEXT,
  specifications JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  image_url TEXT,
  compatible_with TEXT[] DEFAULT '{}'::text[],
  platform TEXT NOT NULL DEFAULT 'general',
  ai_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own parts"
  ON public.parts_inventory
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Team members can view team parts"
  ON public.parts_inventory
  FOR SELECT
  TO authenticated
  USING (team_id IS NOT NULL AND is_team_member(auth.uid(), team_id));

CREATE POLICY "Team owners can manage team parts"
  ON public.parts_inventory
  FOR ALL
  TO authenticated
  USING (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id))
  WITH CHECK (team_id IS NOT NULL AND is_team_owner(auth.uid(), team_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.parts_inventory;
