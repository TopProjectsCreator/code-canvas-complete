
-- Collaboration role enum
CREATE TYPE public.collab_role AS ENUM ('viewer', 'editor', 'admin');

-- Project collaborators
CREATE TABLE public.project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role collab_role NOT NULL DEFAULT 'editor',
  invited_email TEXT,
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can manage collaborators
CREATE POLICY "Project owner can manage collaborators"
  ON public.project_collaborators FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Collaborators can view their own membership
CREATE POLICY "Collaborators can view own membership"
  ON public.project_collaborators FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Code comments
CREATE TABLE public.code_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.code_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.code_comments ENABLE ROW LEVEL SECURITY;

-- Project owner and collaborators can view comments
CREATE POLICY "Project members can view comments"
  ON public.code_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = code_comments.project_id AND user_id = auth.uid() AND accepted = true)
  );

-- Authenticated users who are members can insert comments
CREATE POLICY "Project members can add comments"
  ON public.code_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = code_comments.project_id AND user_id = auth.uid() AND accepted = true)
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.code_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own comments, or project owner can
CREATE POLICY "Users can delete own comments"
  ON public.code_comments FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Code reviews
CREATE TABLE public.code_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'closed')),
  file_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.code_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view reviews"
  ON public.code_reviews FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() OR reviewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project members can create reviews"
  ON public.code_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requester_id AND (
      EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.project_collaborators WHERE project_id = code_reviews.project_id AND user_id = auth.uid() AND accepted = true)
    )
  );

CREATE POLICY "Reviewers can update reviews"
  ON public.code_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid() OR requester_id = auth.uid());

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_collaborators;

-- Triggers
CREATE TRIGGER update_project_collaborators_updated_at
  BEFORE UPDATE ON public.project_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_code_comments_updated_at
  BEFORE UPDATE ON public.code_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_code_reviews_updated_at
  BEFORE UPDATE ON public.code_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
