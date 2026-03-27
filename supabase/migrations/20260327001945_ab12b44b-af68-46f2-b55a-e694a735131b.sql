
-- Extensions table
CREATE TABLE IF NOT EXISTS public.extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  version text NOT NULL DEFAULT '0.1.0',
  install_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Extension versions table
CREATE TABLE IF NOT EXISTS public.extension_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id uuid NOT NULL REFERENCES public.extensions(id) ON DELETE CASCADE,
  version text NOT NULL,
  source_bundle_url text NOT NULL,
  changelog text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(extension_id, version)
);

-- Installed extensions per user
CREATE TABLE IF NOT EXISTS public.installed_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  extension_id uuid NOT NULL REFERENCES public.extensions(id) ON DELETE CASCADE,
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, extension_id)
);

-- Extension reviews / moderation queue
CREATE TABLE IF NOT EXISTS public.extension_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id uuid NOT NULL REFERENCES public.extensions(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installed_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_reviews ENABLE ROW LEVEL SECURITY;

-- Extensions policies
CREATE POLICY "Anyone can view published extensions" ON public.extensions
  FOR SELECT USING (status = 'published');

CREATE POLICY "Owners can view own extensions" ON public.extensions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owners can create extensions" ON public.extensions
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own extensions" ON public.extensions
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete own extensions" ON public.extensions
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Extension versions policies
CREATE POLICY "Anyone can view versions of published extensions" ON public.extension_versions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.extensions WHERE id = extension_versions.extension_id AND status = 'published'
  ));

CREATE POLICY "Owners can manage versions" ON public.extension_versions
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.extensions WHERE id = extension_versions.extension_id AND owner_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.extensions WHERE id = extension_versions.extension_id AND owner_id = auth.uid()
  ));

-- Installed extensions policies
CREATE POLICY "Users can view own installs" ON public.installed_extensions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can install extensions" ON public.installed_extensions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can uninstall extensions" ON public.installed_extensions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Extension reviews policies
CREATE POLICY "Owners can view reviews of own extensions" ON public.extension_reviews
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.extensions WHERE id = extension_reviews.extension_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Submitters can view own reviews" ON public.extension_reviews
  FOR SELECT TO authenticated USING (submitted_by = auth.uid());

CREATE POLICY "Users can submit reviews" ON public.extension_reviews
  FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Admins can manage reviews" ON public.extension_reviews
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_extensions_updated_at BEFORE UPDATE ON public.extensions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_extension_reviews_updated_at BEFORE UPDATE ON public.extension_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
