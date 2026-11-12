-- Make direct message creation idempotent.
--
-- A DM is uniquely identified by its workspace and the sorted pair of
-- participants. The previous client-side check-then-insert could race and
-- create two conversations for the same pair, so the lookup and insert now
-- happen atomically inside create_dm_channel().

ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS dm_user_a uuid,
  ADD COLUMN IF NOT EXISTS dm_user_b uuid;

DROP TABLE IF EXISTS _chat_dm_pairs;
CREATE TEMP TABLE _chat_dm_pairs AS
SELECT
  c.id AS channel_id,
  c.workspace_id,
  c.created_at,
  (array_agg(DISTINCT m.user_id ORDER BY m.user_id))[1] AS user_a,
  (array_agg(DISTINCT m.user_id ORDER BY m.user_id))[2] AS user_b
FROM public.chat_channels c
JOIN public.chat_channel_members m ON m.channel_id = c.id
WHERE c.is_dm
GROUP BY c.id, c.workspace_id, c.created_at
HAVING count(DISTINCT m.user_id) = 2;

DROP TABLE IF EXISTS _chat_dm_keepers;
CREATE TEMP TABLE _chat_dm_keepers AS
SELECT
  workspace_id,
  user_a,
  user_b,
  (array_agg(channel_id ORDER BY created_at, channel_id))[1] AS keeper_id
FROM _chat_dm_pairs
GROUP BY workspace_id, user_a, user_b;

-- Backfill the canonical participant pair for existing DMs.
UPDATE public.chat_channels c
SET dm_user_a = p.user_a,
    dm_user_b = p.user_b
FROM _chat_dm_pairs p
WHERE c.id = p.channel_id
  AND (c.dm_user_a IS DISTINCT FROM p.user_a OR c.dm_user_b IS DISTINCT FROM p.user_b);

-- Merge any already-duplicated conversations into the oldest channel.
INSERT INTO public.chat_channel_members (
  channel_id, user_id, role, last_read_at, notification_prefs, joined_at
)
SELECT k.keeper_id, m.user_id, m.role, m.last_read_at, m.notification_prefs, m.joined_at
FROM public.chat_channel_members m
JOIN _chat_dm_pairs p ON p.channel_id = m.channel_id
JOIN _chat_dm_keepers k
  ON k.workspace_id = p.workspace_id
 AND k.user_a = p.user_a
 AND k.user_b = p.user_b
WHERE p.channel_id <> k.keeper_id
ON CONFLICT (channel_id, user_id) DO NOTHING;

UPDATE public.chat_messages msg
SET channel_id = k.keeper_id
FROM _chat_dm_pairs p
JOIN _chat_dm_keepers k
  ON k.workspace_id = p.workspace_id
 AND k.user_a = p.user_a
 AND k.user_b = p.user_b
WHERE msg.channel_id = p.channel_id
  AND p.channel_id <> k.keeper_id;

DELETE FROM public.chat_channels c
USING _chat_dm_pairs p
JOIN _chat_dm_keepers k
  ON k.workspace_id = p.workspace_id
 AND k.user_a = p.user_a
 AND k.user_b = p.user_b
WHERE c.id = p.channel_id
  AND p.channel_id <> k.keeper_id;

DROP TABLE IF EXISTS _chat_dm_keepers;
DROP TABLE IF EXISTS _chat_dm_pairs;

CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_dm_pair_uidx
  ON public.chat_channels (workspace_id, dm_user_a, dm_user_b)
  WHERE is_dm;

CREATE OR REPLACE FUNCTION public.create_dm_channel(
  _workspace_id uuid,
  _target_user_id uuid
)
RETURNS public.chat_channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_a uuid;
  v_user_b uuid;
  v_name text;
  v_channel public.chat_channels;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace is required' USING ERRCODE = '22023';
  END IF;

  IF _target_user_id IS NULL OR _target_user_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid direct message recipient' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_workspaces w
    WHERE w.id = _workspace_id
      AND (
        w.created_by = v_user_id
        OR EXISTS (
          SELECT 1
          FROM public.chat_channel_members m
          JOIN public.chat_channels c ON c.id = m.channel_id
          WHERE m.user_id = v_user_id AND c.workspace_id = _workspace_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'You are not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  v_user_a := least(v_user_id, _target_user_id);
  v_user_b := greatest(v_user_id, _target_user_id);

  SELECT *
  INTO v_channel
  FROM public.chat_channels
  WHERE workspace_id = _workspace_id
    AND is_dm
    AND dm_user_a = v_user_a
    AND dm_user_b = v_user_b
  LIMIT 1;

  IF v_channel.id IS NOT NULL THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id, role)
    VALUES
      (v_channel.id, v_user_id, 'admin'),
      (v_channel.id, _target_user_id, 'member')
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    RETURN v_channel;
  END IF;

  SELECT string_agg(
           COALESCE(p.display_name, 'User'),
           ', '
           ORDER BY CASE WHEN p.user_id = v_user_a THEN 0 ELSE 1 END
         )
  INTO v_name
  FROM public.profiles p
  WHERE p.user_id IN (v_user_a, v_user_b);

  IF v_name IS NULL OR btrim(v_name) = '' THEN
    v_name := 'Direct message';
  END IF;

  v_channel := NULL;

  INSERT INTO public.chat_channels (
    workspace_id, name, is_dm, is_private, created_by, dm_user_a, dm_user_b
  )
  VALUES (
    _workspace_id, v_name, true, true, v_user_id, v_user_a, v_user_b
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_channel;

  IF v_channel.id IS NULL THEN
    SELECT *
    INTO v_channel
    FROM public.chat_channels
    WHERE workspace_id = _workspace_id
      AND is_dm
      AND dm_user_a = v_user_a
      AND dm_user_b = v_user_b
    LIMIT 1;
  END IF;

  IF v_channel.id IS NULL THEN
    RAISE EXCEPTION 'Could not create direct message channel';
  END IF;

  INSERT INTO public.chat_channel_members (channel_id, user_id, role)
  VALUES
    (v_channel.id, v_user_id, 'admin'),
    (v_channel.id, _target_user_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_dm_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dm_channel(uuid, uuid) TO authenticated, service_role;
