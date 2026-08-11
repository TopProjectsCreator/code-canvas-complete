CREATE OR REPLACE FUNCTION public.save_thread_whiteboard_scene(
  _thread_id uuid,
  _elements jsonb,
  _app_state jsonb DEFAULT '{}'::jsonb,
  _new_files jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_files jsonb := '{}'::jsonb;
  v_referenced_files jsonb := '{}'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(_elements) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Elements must be an array';
  END IF;

  SELECT COALESCE(scene->'files', '{}'::jsonb)
  INTO v_existing_files
  FROM public.thread_whiteboards
  WHERE thread_id = _thread_id
  FOR UPDATE;

  SELECT COALESCE(jsonb_object_agg(files.key, files.value), '{}'::jsonb)
  INTO v_referenced_files
  FROM jsonb_each(v_existing_files || COALESCE(_new_files, '{}'::jsonb)) AS files(key, value)
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_elements) AS element
    WHERE element->>'type' = 'image'
      AND COALESCE((element->>'isDeleted')::boolean, false) = false
      AND element->>'fileId' = files.key
  );

  INSERT INTO public.thread_whiteboards (thread_id, scene, updated_by, updated_at)
  VALUES (
    _thread_id,
    jsonb_build_object(
      'elements', _elements,
      'appState', COALESCE(_app_state, '{}'::jsonb),
      'files', v_referenced_files
    ),
    v_user_id,
    now()
  )
  ON CONFLICT (thread_id) DO UPDATE
  SET scene = EXCLUDED.scene,
      updated_by = v_user_id,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_thread_whiteboard_scene(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_thread_whiteboard_scene(uuid, jsonb, jsonb, jsonb) TO authenticated, service_role;