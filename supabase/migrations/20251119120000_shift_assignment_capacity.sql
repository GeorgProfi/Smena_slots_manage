create or replace function enforce_shift_assignment_capacity()
returns trigger as $$
declare
  cap int;
  filled int;
begin
  select capacity into cap from sub_shifts where id = new.sub_shift_id for update;
  if cap is null then
    raise exception 'Sub-shift not found' using errcode = '23503';
  end if;

  select count(*)::int into filled
  from shift_assignments
  where sub_shift_id = new.sub_shift_id;

  if cap > 0 and filled >= cap then
    raise exception 'Shift is full' using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists shift_assignments_enforce_capacity on shift_assignments;
create trigger shift_assignments_enforce_capacity
  before insert on shift_assignments
  for each row execute procedure enforce_shift_assignment_capacity();