-- Add calendar mode support to firms
-- calendar_mode: 'builtin' = use Supabase appointments table
--                'google'  = use Google Calendar API

ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS calendar_mode TEXT NOT NULL DEFAULT 'builtin',
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

-- Set all existing firms to builtin (safe default)
UPDATE firms SET calendar_mode = 'builtin' WHERE calendar_mode IS NULL;
