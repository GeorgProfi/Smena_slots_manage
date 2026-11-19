alter table swap_requests
  drop constraint if exists swap_requests_accepted_by_id_fkey;
alter table swap_requests
  add constraint swap_requests_accepted_by_id_fkey
  foreign key (accepted_by_id) references profiles(id) on delete set null;

alter table audit_logs
  drop constraint if exists audit_logs_performed_by_fkey;
alter table audit_logs
  add constraint audit_logs_performed_by_fkey
  foreign key (performed_by) references profiles(id) on delete set null;

alter table organization_settings
  drop constraint if exists organization_settings_updated_by_fkey;
alter table organization_settings
  add constraint organization_settings_updated_by_fkey
  foreign key (updated_by) references profiles(id) on delete set null;