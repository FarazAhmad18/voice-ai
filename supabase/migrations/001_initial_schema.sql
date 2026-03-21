-- LawVoice AI - Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run)

-- 1. FIRMS table
CREATE TABLE firms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS table (lawyers/staff)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LEADS table
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  caller_name TEXT NOT NULL DEFAULT 'Unknown Caller',
  caller_phone TEXT,
  caller_email TEXT,
  case_type TEXT DEFAULT 'other',
  urgency TEXT DEFAULT 'low',
  score INTEGER DEFAULT 0,
  score_label TEXT DEFAULT 'cold',
  status TEXT DEFAULT 'new',
  notes TEXT,
  appointment_booked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CALLS table
CREATE TABLE calls (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  vapi_call_id TEXT,
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  duration INTEGER DEFAULT 0,
  ended_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. APPOINTMENTS table
CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  caller_name TEXT,
  caller_phone TEXT,
  caller_email TEXT,
  case_type TEXT,
  appointment_date TEXT,
  appointment_time TEXT,
  urgency TEXT DEFAULT 'low',
  notes TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INTAKE_ANSWERS table
CREATE TABLE intake_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT REFERENCES calls(id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  question TEXT,
  answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_leads_firm_id ON leads(firm_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_calls_lead_id ON calls(lead_id);
CREATE INDEX idx_appointments_firm_id ON appointments(firm_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);

-- Insert a default firm for testing (Mitchell Family Law)
INSERT INTO firms (id, name, email, phone)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Mitchell Family Law',
  'contact@mitchellfamilylaw.com',
  '4257623355'
);

-- Insert a default admin user
INSERT INTO users (firm_id, email, name, role)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@mitchellfamilylaw.com',
  'Admin',
  'admin'
);
