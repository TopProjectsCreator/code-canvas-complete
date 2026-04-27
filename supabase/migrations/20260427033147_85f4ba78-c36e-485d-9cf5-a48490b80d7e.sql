CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'message',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_recipient ON public.messages(recipient_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can send messages as themselves"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view their own messages"
ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

CREATE POLICY "Recipients can update read state"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Participants can delete their messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;