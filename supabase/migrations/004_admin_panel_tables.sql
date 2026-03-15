-- ============================================================
-- Migration 004: Admin panel tables
-- Adds: staff, prompt_templates, industry_configs
-- Updates: firms with new columns
-- ============================================================

-- 1. STAFF table
CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT,
  specialization  TEXT,
  email           TEXT,
  phone           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  calendar_id     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_firm_id ON staff(firm_id);

-- 2. PROMPT TEMPLATES table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  industry          TEXT NOT NULL,
  body              TEXT NOT NULL,
  variables         JSONB DEFAULT '[]',
  intake_questions  JSONB DEFAULT '[]',
  case_types        JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDUSTRY CONFIGS table
CREATE TABLE IF NOT EXISTS industry_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry        TEXT UNIQUE NOT NULL,
  lead_label      TEXT DEFAULT 'Leads',
  case_label      TEXT DEFAULT 'Case Type',
  staff_label     TEXT DEFAULT 'Staff',
  case_types      JSONB DEFAULT '[]',
  score_weights   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add new columns to firms table
ALTER TABLE firms ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'other';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#6d28d9';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS business_hours TEXT DEFAULT '9:00 AM - 5:00 PM, Monday - Friday';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS retell_agent_id TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS retell_phone_number TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS agent_name TEXT DEFAULT 'AI Assistant';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS agent_voice_id TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS prompt_template_id UUID;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS rendered_prompt TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS crm_mode TEXT DEFAULT 'builtin';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS crm_type TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS crm_webhook_url TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS crm_api_key TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS crm_access_token TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS crm_field_mapping JSONB DEFAULT '{}';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 5. Add avatar_url to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 6. Index on firms
CREATE INDEX IF NOT EXISTS idx_firms_retell_agent_id ON firms(retell_agent_id);

-- 7. Seed industry configs
INSERT INTO industry_configs (industry, lead_label, case_label, staff_label, case_types) VALUES
  ('legal', 'Leads', 'Case Type', 'Attorney', '["divorce","custody","support","domestic_violence","paternity","adoption","other"]'),
  ('dental', 'Patient Inquiries', 'Treatment Type', 'Doctor', '["cleaning","filling","root_canal","whitening","braces","extraction","consultation","other"]'),
  ('plumbing', 'Service Requests', 'Job Type', 'Technician', '["leak_repair","drain_cleaning","water_heater","pipe_replacement","emergency","inspection","other"]'),
  ('real_estate', 'Inquiries', 'Property Type', 'Agent', '["buying","selling","rental","commercial","consultation","other"]'),
  ('medical', 'Patient Inquiries', 'Visit Type', 'Doctor', '["checkup","urgent_care","specialist","follow_up","vaccination","other"]'),
  ('other', 'Inquiries', 'Service Type', 'Staff', '["consultation","general","other"]')
ON CONFLICT (industry) DO NOTHING;

-- 8. Seed default prompt templates
INSERT INTO prompt_templates (name, industry, body, case_types) VALUES
  ('Legal - Family Law', 'legal',
   'You are {{agent_name}}, a professional AI legal assistant for {{company_name}}.

AVAILABLE ATTORNEYS:
{{active_staff}}

BUSINESS HOURS: {{business_hours}}

YOUR JOB:
1. Greet professionally, introduce yourself
2. Ask their name and best contact number
3. Ask what legal matter they need help with
4. Based on their answer, ask intake questions:
   FOR DIVORCE: Are papers filed? How long married? Children involved (ages)? Shared assets? Safety concerns?
   FOR CUSTODY: Existing order? What changes sought? Safety concerns? Upcoming hearing date?
   FOR SUPPORT: Current arrangement? Changes needed? Income situation?
5. Assess urgency level (low/medium/high)
6. Check available appointment slots using check_availability tool
7. Book consultation using book_appointment tool
8. Confirm details and say goodbye

RULES:
- Be empathetic — callers are often in distress
- NEVER give legal advice
- If emergency (safety threat), say "Please call 911"
- If caller insists on speaking to a human, offer to transfer
- Keep conversation under 8 minutes',
   '["divorce","custody","support","domestic_violence","paternity","adoption","other"]'),

  ('Dental - General Practice', 'dental',
   'You are {{agent_name}}, a friendly AI receptionist for {{company_name}}.

AVAILABLE DOCTORS:
{{active_staff}}

BUSINESS HOURS: {{business_hours}}

YOUR JOB:
1. Greet warmly
2. Ask their name and phone number
3. Ask what dental service they need ({{services}})
4. Ask intake questions:
   - New or existing patient?
   - Last dental visit?
   - Currently experiencing pain or discomfort?
   - Dental insurance?
5. Check available appointment slots
6. Book with the appropriate doctor
7. Confirm and say goodbye

RULES:
- Be warm and reassuring (dental anxiety is common)
- Never give medical advice
- If emergency (severe pain, bleeding), say "Please go to nearest ER"
- Keep call under 5 minutes',
   '["cleaning","filling","root_canal","whitening","braces","extraction","consultation","other"]'),

  ('Plumbing - Home Services', 'plumbing',
   'You are {{agent_name}}, a helpful AI dispatcher for {{company_name}}.

AVAILABLE TECHNICIANS:
{{active_staff}}

BUSINESS HOURS: {{business_hours}}

YOUR JOB:
1. Greet warmly
2. Ask their name and phone number
3. Ask what plumbing issue they have ({{services}})
4. Ask:
   - Is this an emergency (active flooding, no water, gas leak)?
   - Location/address?
   - When did the issue start?
   - Have you tried anything to fix it?
5. Schedule a service appointment
6. Confirm details

RULES:
- If gas leak or flooding, say "Please turn off your main water/gas valve and call 911 if needed"
- Be friendly and professional
- Keep call under 5 minutes',
   '["leak_repair","drain_cleaning","water_heater","pipe_replacement","emergency","inspection","other"]')
ON CONFLICT DO NOTHING;

-- 9. Update Mitchell Family Law firm with new fields
UPDATE firms
SET
  industry = 'legal',
  business_hours = '9:00 AM - 5:00 PM, Monday - Friday',
  agent_name = 'Samantha',
  brand_color = '#1d4ed8',
  status = 'active'
WHERE id = 'a0000000-0000-0000-0000-000000000001';
