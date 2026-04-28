-- Add attachments and labels columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_labels ON public.messages USING GIN (labels);

-- Inbox rules table
CREATE TABLE IF NOT EXISTS public.inbox_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled rule',
  enabled boolean NOT NULL DEFAULT true,
  match text NOT NULL DEFAULT 'all',
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_rules_user ON public.inbox_rules(user_id, position);

ALTER TABLE public.inbox_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own rules - select" ON public.inbox_rules;
CREATE POLICY "Users manage their own rules - select"
ON public.inbox_rules FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own rules - insert" ON public.inbox_rules;
CREATE POLICY "Users manage their own rules - insert"
ON public.inbox_rules FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own rules - update" ON public.inbox_rules;
CREATE POLICY "Users manage their own rules - update"
ON public.inbox_rules FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own rules - delete" ON public.inbox_rules;
CREATE POLICY "Users manage their own rules - delete"
ON public.inbox_rules FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Inbox attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('inbox-attachments', 'inbox-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Inbox attachments - upload by sender" ON storage.objects;
CREATE POLICY "Inbox attachments - upload by sender"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inbox-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Inbox attachments - read by sender" ON storage.objects;
CREATE POLICY "Inbox attachments - read by sender"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inbox-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Inbox attachments - read by message participant" ON storage.objects;
CREATE POLICY "Inbox attachments - read by message participant"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inbox-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id::text = (storage.foldername(name))[2]
      AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Inbox attachments - delete by sender" ON storage.objects;
CREATE POLICY "Inbox attachments - delete by sender"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inbox-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_rules;