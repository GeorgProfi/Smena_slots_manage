CREATE OR REPLACE FUNCTION enforce_shift_assignment_capacity()
RETURNS TRIGGER AS $$
DECLARE
  cap INT;
  filled INT;
BEGIN
  SELECT capacity INTO cap FROM sub_shifts WHERE id = NEW.sub_shift_id FOR UPDATE;
  IF cap IS NULL THEN
    RAISE EXCEPTION 'Sub-shift not found' USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*)::int INTO filled
  FROM shift_assignments
  WHERE sub_shift_id = NEW.sub_shift_id;

  IF cap > 0 AND filled >= cap THEN
    RAISE EXCEPTION 'Shift is full' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shift_assignments_enforce_capacity ON shift_assignments;
CREATE TRIGGER shift_assignments_enforce_capacity
  BEFORE INSERT ON shift_assignments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_shift_assignment_capacity();