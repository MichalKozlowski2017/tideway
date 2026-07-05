ALTER TABLE raw_items
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

UPDATE raw_items SET status_changed_at = fetched_at;

CREATE OR REPLACE FUNCTION raw_items_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS raw_items_status_changed_at_trg ON raw_items;

CREATE TRIGGER raw_items_status_changed_at_trg
  BEFORE UPDATE ON raw_items
  FOR EACH ROW
  EXECUTE FUNCTION raw_items_status_changed_at();

CREATE OR REPLACE FUNCTION cleanup_raw_items(
  pending_max_age_days integer DEFAULT 7,
  terminal_max_age_days integer DEFAULT 14,
  processing_max_age_hours integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_pending integer;
  deleted_terminal integer;
  deleted_processing integer;
BEGIN
  WITH deleted AS (
    DELETE FROM raw_items ri
    WHERE ri.status = 'pending'
      AND ri.fetched_at < now() - (pending_max_age_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM articles a WHERE ri.id = ANY(a.source_item_ids)
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_pending FROM deleted;

  WITH deleted AS (
    DELETE FROM raw_items ri
    WHERE ri.status IN ('failed', 'skipped')
      AND ri.fetched_at < now() - (terminal_max_age_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM articles a WHERE ri.id = ANY(a.source_item_ids)
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_terminal FROM deleted;

  WITH deleted AS (
    DELETE FROM raw_items ri
    WHERE ri.status = 'processing'
      AND ri.status_changed_at < now() - (processing_max_age_hours || ' hours')::interval
      AND NOT EXISTS (
        SELECT 1 FROM articles a WHERE ri.id = ANY(a.source_item_ids)
      )
    RETURNING id
  )
  SELECT count(*) INTO deleted_processing FROM deleted;

  RETURN jsonb_build_object(
    'deleted_pending', deleted_pending,
    'deleted_terminal', deleted_terminal,
    'deleted_processing', deleted_processing
  );
END;
$$;
