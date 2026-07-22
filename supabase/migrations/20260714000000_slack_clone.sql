-- Slack Clone — Chat Workspaces, Channels, Messages, Reactions, Attachments, Presence

-- 1. Chat Workspaces
CREATE TABLE IF NOT EXISTS public.chat_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_workspaces_team ON public.chat_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_chat_workspaces_created_by ON public.chat_workspaces(created_by);

ALTER TABLE public.chat_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view"
ON public.chat_workspaces FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channel_members cm
    JOIN public.chat_channels c ON c.id = cm.channel_id
    WHERE c.workspace_id = chat_workspaces.id AND cm.user_id = auth.uid()
  )
  OR team_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = chat_workspaces.team_id AND tm.user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Users can create workspaces"
ON public.chat_workspaces FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Workspace creator can update"
ON public.chat_workspaces FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Workspace creator can delete"
ON public.chat_workspaces FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- 2. Chat Channels
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.chat_workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  topic TEXT,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_dm BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_workspace ON public.chat_channels(workspace_id);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel members can view"
ON public.chat_channels FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channel_members cm
    WHERE cm.channel_id = chat_channels.id AND cm.user_id = auth.uid()
  )
  OR (NOT is_private AND EXISTS (
    SELECT 1 FROM public.chat_channel_members cm
    JOIN public.chat_channels c ON c.id = cm.channel_id
    WHERE c.workspace_id = chat_channels.workspace_id AND cm.user_id = auth.uid()
  ))
  OR created_by = auth.uid()
);

CREATE POLICY "Users can create channels"
ON public.chat_channels FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel creator can update"
ON public.chat_channels FOR UPDATE TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel creator can delete"
ON public.chat_channels FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- 3. Chat Channel Members
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  last_read_at TIMESTAMPTZ,
  notification_prefs JSONB NOT NULL DEFAULT '{"all": true}'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel ON public.chat_channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user ON public.chat_channel_members(user_id);

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their memberships"
ON public.chat_channel_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.chat_channel_members cm2
  WHERE cm2.channel_id = chat_channel_members.channel_id AND cm2.user_id = auth.uid()
));

CREATE POLICY "Users can join channels"
ON public.chat_channel_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their membership"
ON public.chat_channel_members FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave channels"
ON public.chat_channel_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 4. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  body_html TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON public.chat_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pinned ON public.chat_messages(channel_id, is_pinned) WHERE is_pinned = true;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel members can view messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channel_members cm
    WHERE cm.channel_id = chat_messages.channel_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Channel members can insert messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_channel_members cm
    WHERE cm.channel_id = chat_messages.channel_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON public.chat_messages FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 5. Chat Message Reactions
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON public.chat_message_reactions(message_id);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel members can view reactions"
ON public.chat_message_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    JOIN public.chat_channel_members cm ON cm.channel_id = m.channel_id
    WHERE m.id = chat_message_reactions.message_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add reactions"
ON public.chat_message_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their reactions"
ON public.chat_message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 6. Chat Message Attachments
CREATE TABLE IF NOT EXISTS public.chat_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON public.chat_message_attachments(message_id);

ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel members can view attachments"
ON public.chat_message_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    JOIN public.chat_channel_members cm ON cm.channel_id = m.channel_id
    WHERE m.id = chat_message_attachments.message_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add attachments to their messages"
ON public.chat_message_attachments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = chat_message_attachments.message_id AND m.user_id = auth.uid()
  )
);

-- 7. Chat User Presence
CREATE TABLE IF NOT EXISTS public.chat_user_presence (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.chat_workspaces(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  custom_status_text TEXT,
  custom_status_emoji TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);

ALTER TABLE public.chat_user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view presence"
ON public.chat_user_presence FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channel_members cm
    JOIN public.chat_channels c ON c.id = cm.channel_id
    WHERE c.workspace_id = chat_user_presence.workspace_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own presence"
ON public.chat_user_presence FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence"
ON public.chat_user_presence FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Chat attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: <user_id>/<message_id>/<filename>
CREATE POLICY "Chat attachments - upload by sender"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Chat attachments - read by channel member"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.chat_message_attachments a
    JOIN public.chat_messages m ON m.id = a.message_id
    JOIN public.chat_channel_members cm ON cm.channel_id = m.channel_id
    WHERE a.storage_path = name AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Chat attachments - delete by owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Auto-create #general and #random channels when a workspace is created
CREATE OR REPLACE FUNCTION public.handle_new_chat_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_channels (workspace_id, name, topic, description, is_private, created_by)
  VALUES
    (NEW.id, 'general', 'General discussion', 'General chat for the workspace', false, NEW.created_by),
    (NEW.id, 'random', 'Random and off-topic', 'Random stuff that does not fit elsewhere', false, NEW.created_by);

  INSERT INTO public.chat_channel_members (channel_id, user_id, role)
  SELECT c.id, NEW.created_by, 'admin'
  FROM public.chat_channels c
  WHERE c.workspace_id = NEW.id AND c.name IN ('general', 'random');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_workspace_created ON public.chat_workspaces;
CREATE TRIGGER on_chat_workspace_created
  AFTER INSERT ON public.chat_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_chat_workspace();

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
