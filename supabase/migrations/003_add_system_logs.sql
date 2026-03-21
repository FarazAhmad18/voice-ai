-- ============================================================
-- Migration 003: Add system_logs + Retell migration columns
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID REFERENCES firms(id) ON DELETE SET NULL,
  level       TEXT NOT NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  details     JSONB DEFAULT '{}',
  source      TEXT,
  call_id     TEXT,
  lead_id     TEXT,
  user_id     UUID,
  ip_address  TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_firm_id ON system_logs(firm_id);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_call_id ON system_logs(call_id);

-- 2. Add retell_call_id to calls table (replacing vapi_call_id)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS retell_call_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment TEXT;

-- 3. Add missing columns to leads (for Retell migration)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'phone';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_staff_id UUID;

-- 4. Add missing columns to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_staff_id UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- 5. Add firm_id to intake_answers (was missing)
ALTER TABLE intake_answers ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id) ON DELETE CASCADE;
