-- Add call_notes (JSONB array), assigned_attorney, and follow_up_date to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_notes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_attorney text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date date;
