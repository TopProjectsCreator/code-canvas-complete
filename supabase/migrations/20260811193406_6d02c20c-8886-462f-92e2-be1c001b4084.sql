CREATE OR REPLACE FUNCTION public.archive_whiteboard_scene()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text;
  v_id text;
  v_count integer;
  v_last_snapshot_at timestamptz;
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
    SELECT max(created_at)
      INTO v_last_snapshot_at
      FROM public.whiteboard_snapshots
     WHERE board_kind = v_kind
       AND board_id = v_id;

    IF v_last_snapshot_at IS NULL OR v_last_snapshot_at < now() - interval '5 minutes' THEN
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
  END IF;

  RETURN NEW;
END;
$function$;