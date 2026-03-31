-- Add retell_call_id to appointments table
-- This links an appointment to the specific call that created it,
-- solving the timing issue where the lead doesn't exist yet during the call.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS retell_call_id TEXT;
CREATE INDEX IF NOT EXISTS idx_appointments_retell_call_id ON appointments(retell_call_id);
