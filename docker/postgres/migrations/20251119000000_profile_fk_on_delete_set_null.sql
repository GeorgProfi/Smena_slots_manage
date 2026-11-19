-- Allow profile deletion when referenced as swap accepter or in audit/settings metadata
ALTER TABLE swap_requests
  DROP CONSTRAINT IF EXISTS swap_requests_accepted_by_id_fkey;
ALTER TABLE swap_requests
  ADD CONSTRAINT swap_requests_accepted_by_id_fkey
  FOREIGN KEY (accepted_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_performed_by_fkey;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_performed_by_fkey
  FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE organization_settings
  DROP CONSTRAINT IF EXISTS organization_settings_updated_by_fkey;
ALTER TABLE organization_settings
  ADD CONSTRAINT organization_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;