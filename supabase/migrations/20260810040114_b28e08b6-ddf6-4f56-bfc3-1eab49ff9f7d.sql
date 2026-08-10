CREATE TABLE public.whiteboard_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_kind text NOT NULL,
  board_id text NOT NULL,
  scene jsonb NOT NULL,
  element_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whiteboard_snapshots_board_idx ON public.whiteboard_snapshots (board_kind, board_id, created_at DESC);

GRANT SELECT, INSERT ON public.whiteboard_snapshots TO authenticated;
GRANT SELECT ON public.whiteboard_snapshots TO anon;
GRANT ALL ON public.whiteboard_snapshots TO service_role;

ALTER TABLE public.whiteboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view whiteboard snapshots"
  ON public.whiteboard_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can create whiteboard snapshots"
  ON public.whiteboard_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.archive_whiteboard_scene()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_count integer;
  new_count integer;
  kind text;
  bid text;
BEGIN
  old_count := COALESCE(jsonb_array_length(COALESCE(OLD.scene->'elements', '[]'::jsonb)), 0);
  new_count := COALESCE(jsonb_array_length(COALESCE(NEW.scene->'elements', '[]'::jsonb)), 0);

  IF TG_TABLE_NAME = 'global_whiteboard' THEN
    kind := 'global';
    bid := OLD.id::text;
  ELSE
    kind := 'thread';
    bid := OLD.thread_id::text;
  END IF;

  IF old_count > 0 AND OLD.scene IS DISTINCT FROM NEW.scene THEN
    INSERT INTO public.whiteboard_snapshots (board_kind, board_id, scene, element_count, created_by)
    VALUES (kind, bid, OLD.scene, old_count, OLD.updated_by);

    DELETE FROM public.whiteboard_snapshots s
    WHERE s.board_kind = kind AND s.board_id = bid
      AND s.id NOT IN (
        SELECT id FROM public.whiteboard_snapshots
        WHERE board_kind = kind AND board_id = bid
        ORDER BY created_at DESC
        LIMIT 100
      );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER archive_global_whiteboard_scene
  BEFORE UPDATE ON public.global_whiteboard
  FOR EACH ROW EXECUTE FUNCTION public.archive_whiteboard_scene();

CREATE TRIGGER archive_thread_whiteboard_scene
  BEFORE UPDATE ON public.thread_whiteboards
  FOR EACH ROW EXECUTE FUNCTION public.archive_whiteboard_scene();

INSERT INTO public.whiteboard_snapshots (board_kind, board_id, scene, element_count, created_by)
SELECT 'global', id::text, scene, COALESCE(jsonb_array_length(COALESCE(scene->'elements','[]'::jsonb)),0), updated_by
FROM public.global_whiteboard
WHERE COALESCE(jsonb_array_length(COALESCE(scene->'elements','[]'::jsonb)),0) > 0;