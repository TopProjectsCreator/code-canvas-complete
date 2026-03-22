
-- Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'member',
  spending_limit_cents integer,
  display_name text,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team policies (forced settings)
CREATE TABLE public.team_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  policy_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enforced boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_policies ENABLE ROW LEVEL SECURITY;

-- Team forms/surveys
CREATE TABLE public.team_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_forms ENABLE ROW LEVEL SECURITY;

-- Team form responses
CREATE TABLE public.team_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.team_forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_form_responses ENABLE ROW LEVEL SECURITY;

-- Team custom templates
CREATE TABLE public.team_custom_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  language text NOT NULL DEFAULT 'typescript',
  is_required boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_custom_templates ENABLE ROW LEVEL SECURITY;

-- Team spending tracking
CREATE TABLE public.team_spending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'ai',
  description text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_spending ENABLE ROW LEVEL SECURITY;

-- RLS: Teams - owner can do everything, members can view
CREATE POLICY "Team owners can manage teams" ON public.teams FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team members can view team" ON public.teams FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = teams.id AND team_members.user_id = auth.uid()));

-- RLS: Team members - owner/admin can manage, members can view
CREATE POLICY "Team owners can manage members" ON public.team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND teams.owner_id = auth.uid()));

CREATE POLICY "Members can view team members" ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid()));

-- RLS: Policies - owner manages, members view
CREATE POLICY "Team owners can manage policies" ON public.team_policies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_policies.team_id AND teams.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_policies.team_id AND teams.owner_id = auth.uid()));

CREATE POLICY "Members can view policies" ON public.team_policies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = team_policies.team_id AND team_members.user_id = auth.uid()));

-- RLS: Forms - owner creates, members view
CREATE POLICY "Team owners can manage forms" ON public.team_forms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_forms.team_id AND teams.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_forms.team_id AND teams.owner_id = auth.uid()));

CREATE POLICY "Members can view forms" ON public.team_forms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = team_forms.team_id AND team_members.user_id = auth.uid()));

-- RLS: Form responses - users manage own, owners view all
CREATE POLICY "Users can submit responses" ON public.team_form_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own responses" ON public.team_form_responses FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Form owners can view all responses" ON public.team_form_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_forms tf
    JOIN public.teams t ON t.id = tf.team_id
    WHERE tf.id = team_form_responses.form_id AND t.owner_id = auth.uid()
  ));

-- RLS: Custom templates
CREATE POLICY "Team owners can manage templates" ON public.team_custom_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_custom_templates.team_id AND teams.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_custom_templates.team_id AND teams.owner_id = auth.uid()));

CREATE POLICY "Members can view templates" ON public.team_custom_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members WHERE team_members.team_id = team_custom_templates.team_id AND team_members.user_id = auth.uid()));

-- RLS: Spending
CREATE POLICY "Team owners can manage spending" ON public.team_spending FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_spending.team_id AND teams.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams WHERE teams.id = team_spending.team_id AND teams.owner_id = auth.uid()));

CREATE POLICY "Users can view own spending" ON public.team_spending FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Updated at triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_policies_updated_at BEFORE UPDATE ON public.team_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_forms_updated_at BEFORE UPDATE ON public.team_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_custom_templates_updated_at BEFORE UPDATE ON public.team_custom_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
