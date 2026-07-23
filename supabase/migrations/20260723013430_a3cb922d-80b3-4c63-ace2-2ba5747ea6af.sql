
-- ============= tables first (no cross refs to helper functions) =============
CREATE TABLE public.chat_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  icon_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.chat_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  topic text,
  description text,
  is_private boolean NOT NULL DEFAULT false,
  is_dm boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_channels_workspace_idx ON public.chat_channels(workspace_id);

CREATE TABLE public.chat_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  last_read_at timestamptz,
  notification_prefs jsonb NOT NULL DEFAULT '{"all":true}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
CREATE INDEX chat_channel_members_user_idx ON public.chat_channel_members(user_id);
CREATE INDEX chat_channel_members_channel_idx ON public.chat_channel_members(channel_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  body_html text,
  is_pinned boolean NOT NULL DEFAULT false,
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_channel_created_idx ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX chat_messages_parent_idx ON public.chat_messages(parent_id);
CREATE INDEX chat_messages_body_fts_idx ON public.chat_messages USING gin (to_tsvector('english', body));

CREATE TABLE public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE public.chat_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_user_presence (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.chat_workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','away','busy','offline')),
  custom_status_text text,
  custom_status_emoji text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);

-- ============= grants =============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_user_presence TO authenticated;
GRANT ALL ON public.chat_workspaces, public.chat_channels, public.chat_channel_members,
  public.chat_messages, public.chat_message_reactions, public.chat_message_attachments,
  public.chat_user_presence TO service_role;

-- ============= helper functions =============
CREATE OR REPLACE FUNCTION public.is_chat_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_channel_members WHERE user_id = _user_id AND channel_id = _channel_id);
$$;

CREATE OR REPLACE FUNCTION public.is_chat_channel_admin(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_channel_members WHERE user_id = _user_id AND channel_id = _channel_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_chat_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members m
    JOIN public.chat_channels c ON c.id = m.channel_id
    WHERE m.user_id = _user_id AND c.workspace_id = _workspace_id
  );
$$;

-- ============= RLS enable =============
ALTER TABLE public.chat_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_user_presence ENABLE ROW LEVEL SECURITY;

-- ============= policies =============
CREATE POLICY "Members or creator can view workspace" ON public.chat_workspaces
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_chat_workspace_member(auth.uid(), id));
CREATE POLICY "Authenticated can create workspace" ON public.chat_workspaces
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can update workspace" ON public.chat_workspaces
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can delete workspace" ON public.chat_workspaces
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Members or creator can view channel" ON public.chat_channels
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_chat_channel_member(auth.uid(), id));
CREATE POLICY "Workspace members can create channel" ON public.chat_channels
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND (
      public.is_chat_workspace_member(auth.uid(), workspace_id)
      OR EXISTS (SELECT 1 FROM public.chat_workspaces w WHERE w.id = workspace_id AND w.created_by = auth.uid())
    )
  );
CREATE POLICY "Channel admins or creator can update channel" ON public.chat_channels
  FOR UPDATE TO authenticated
  USING (public.is_chat_channel_admin(auth.uid(), id) OR created_by = auth.uid())
  WITH CHECK (public.is_chat_channel_admin(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "Channel admins or creator can delete channel" ON public.chat_channels
  FOR DELETE TO authenticated USING (public.is_chat_channel_admin(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Members can view membership" ON public.chat_channel_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_channel_member(auth.uid(), channel_id));
CREATE POLICY "Users can join; admins/creators can add others" ON public.chat_channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_chat_channel_admin(auth.uid(), channel_id)
    OR EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND c.created_by = auth.uid())
  );
CREATE POLICY "Users update own membership; admins any" ON public.chat_channel_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), channel_id))
  WITH CHECK (user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), channel_id));
CREATE POLICY "Users leave; admins remove" ON public.chat_channel_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), channel_id));

CREATE POLICY "Members can read messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (public.is_chat_channel_member(auth.uid(), channel_id));
CREATE POLICY "Members can post messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_chat_channel_member(auth.uid(), channel_id));
CREATE POLICY "Authors or admins can update messages" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), channel_id))
  WITH CHECK (user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), channel_id));
CREATE POLICY "Authors or admins can delete messages" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), channel_id));

CREATE POLICY "Members can read reactions" ON public.chat_message_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_channel_member(auth.uid(), m.channel_id)));
CREATE POLICY "Members can react" ON public.chat_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_channel_member(auth.uid(), m.channel_id)));
CREATE POLICY "Users can remove their reactions" ON public.chat_message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members can read attachments" ON public.chat_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.is_chat_channel_member(auth.uid(), m.channel_id)));
CREATE POLICY "Message authors can add attachments" ON public.chat_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND m.user_id = auth.uid()));
CREATE POLICY "Authors or admins can delete attachments" ON public.chat_message_attachments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND (m.user_id = auth.uid() OR public.is_chat_channel_admin(auth.uid(), m.channel_id))));

CREATE POLICY "Workspace members can view presence" ON public.chat_user_presence
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users insert own presence" ON public.chat_user_presence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own presence" ON public.chat_user_presence
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own presence" ON public.chat_user_presence
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============= updated_at triggers =============
CREATE TRIGGER chat_workspaces_updated_at BEFORE UPDATE ON public.chat_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER chat_channels_updated_at BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= realtime =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channel_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_user_presence;
