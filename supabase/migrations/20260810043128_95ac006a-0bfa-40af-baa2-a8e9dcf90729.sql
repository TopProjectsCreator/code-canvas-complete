CREATE TABLE IF NOT EXISTS public.whiteboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_kind text NOT NULL CHECK (board_kind IN ('global', 'thread')),
  board_id text NOT NULL,
  scene jsonb NOT NULL,
  element_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whiteboard_snapshots_board_idx
  ON public.whiteboard_snapshots (board_kind, board_id, created_at DESC);

GRANT SELECT, INSERT ON public.whiteboard_snapshots TO authenticated;
GRANT ALL ON public.whiteboard_snapshots TO service_role;

ALTER TABLE public.whiteboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view whiteboard snapshots" ON public.whiteboard_snapshots;
CREATE POLICY "Authenticated users can view whiteboard snapshots"
  ON public.whiteboard_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create whiteboard snapshots" ON public.whiteboard_snapshots;
CREATE POLICY "Authenticated users can create whiteboard snapshots"
  ON public.whiteboard_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.archive_whiteboard_scene()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_id text;
  v_count integer;
BEGIN
  IF TG_TABLE_NAME = 'global_whiteboard' THEN
    v_kind := 'global';
    v_id := OLD.id::text;
  ELSE
    v_kind := 'thread';
    v_id := OLD.thread_id::text;
  END IF;

  v_count := COALESCE(jsonb_array_length(OLD.scene -> 'elements'), 0);

  IF v_count > 0 THEN
    INSERT INTO public.whiteboard_snapshots (board_kind, board_id, scene, element_count, created_by)
    VALUES (v_kind, v_id, OLD.scene, v_count, OLD.updated_by);

    DELETE FROM public.whiteboard_snapshots s
    WHERE s.board_kind = v_kind
      AND s.board_id = v_id
      AND s.id NOT IN (
        SELECT id FROM public.whiteboard_snapshots
        WHERE board_kind = v_kind AND board_id = v_id
        ORDER BY created_at DESC
        LIMIT 100
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_whiteboard_scene() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS archive_global_whiteboard ON public.global_whiteboard;
CREATE TRIGGER archive_global_whiteboard
  BEFORE UPDATE ON public.global_whiteboard
  FOR EACH ROW EXECUTE FUNCTION public.archive_whiteboard_scene();

DROP TRIGGER IF EXISTS archive_thread_whiteboard ON public.thread_whiteboards;
CREATE TRIGGER archive_thread_whiteboard
  BEFORE UPDATE ON public.thread_whiteboards
  FOR EACH ROW EXECUTE FUNCTION public.archive_whiteboard_scene();