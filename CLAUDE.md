# LeapingAI — Technical Specification

> This file is the single source of truth for development. Read it fully before writing any code.

## 1. Project Overview

**Product**: White-label AI voice CRM platform.
**You** (super admin) onboard clients (law firms, dental clinics, plumbers, etc.), deploy a custom Retell AI voice agent for each, and give them a branded dashboard — or push data to their existing CRM.

**Current state**: Single-tenant law firm dashboard (Mitchell Family Law) with VAPI integration.
**Target state**: Multi-tenant platform with Retell AI, admin panel, messaging hub, CRM integrations.

### Tech Stack

| Layer | Current | Target |
|-------|---------|--------|
| Voice AI | VAPI | **Retell AI** |
| Backend | Express.js (Node) | Express.js (Node) — same |
| Database | Supabase (Postgres) + local fallback | Supabase (Postgres) — remove local fallback |
| Frontend | React + Vite + Tailwind | React + Vite + Tailwind — same |
| Auth | None | **Supabase Auth** (JWT, 3 roles) |
| SMS | None | **Twilio** |
| Email | None | **Resend** (or SendGrid) |
| Calendar | Google Calendar API | Google Calendar API — same |
| Hosting | Not deployed | Vercel (FE) + Render (BE) |

### Three User Roles

| Role | Who | Access |
|------|-----|--------|
| `super_admin` | You (platform owner) | Everything. Admin panel. All clients. |
| `admin` | Client owner (e.g., the lawyer) | Their own dashboard, leads, staff, settings. Cannot see other clients. |
| `staff` | Client's team (e.g., paralegal) | Their firm's dashboard. Cannot edit settings or manage staff. |

---

## 2. Target File Structure

```
/server
  index.js                         — Express entry point
  /routes
    auth.js                        — POST /api/auth/signup, /login, /me
    retellWebhook.js               — POST /api/retell/webhook (call_started, call_ended, call_analyzed)
    retellTools.js                 — POST /api/retell/tool/* (check-availability, book-appointment, save-intake-data)
    leads.js                       — GET/PATCH /api/leads, GET /api/leads/:id
    appointments.js                — GET/PATCH /api/appointments
    messages.js                    — GET/POST /api/messages (SMS, email, notes)
    staff.js                       — GET/POST/PATCH/DELETE /api/staff
    firms.js                       — GET/POST/PATCH /api/firms (admin only)
    templates.js                   — GET/POST/PATCH /api/templates (admin only)
    logs.js                        — GET /api/logs (super_admin only)
    twilioWebhook.js               — POST /api/twilio/sms (inbound SMS from Twilio)
  /controllers
    webhookController.js           — Process Retell call events → create leads
    messageController.js           — Send SMS/email, handle inbound
    agentController.js             — Create/update Retell agents via API
    crmPushController.js           — Push lead data to external CRMs
  /services
    supabase.js                    — Supabase client (required, no fallback)
    retell.js                      — Retell API client (create/update/delete agents)
    twilio.js                      — Twilio SMS send + verify signatures
    email.js                       — Resend/SendGrid email service
    leadScoring.js                 — Score 0-100, configurable per industry
    googleCalendar.js              — Existing calendar service (unchanged)
    promptRenderer.js              — Render {{variables}} in prompt templates
    logger.js                      — Structured logger (console + DB, levels: error/warn/info/debug)
    scheduler.js                   — Cron jobs (reminders, follow-ups)
  /middleware
    auth.js                        — Verify Supabase JWT, attach user + firm to req
    requireRole.js                 — Role-based access: requireRole('super_admin')
    validateBody.js                — Request body validation helper

/client
  /src
    main.jsx                       — App entry
    App.jsx                        — Router with auth guards
    /context
      AuthContext.jsx              — Supabase auth state, user, firm config
      FirmContext.jsx              — Firm config (labels, colors, industry) for white-label
    /pages
      Login.jsx                    — Supabase Auth login
      /admin                       — Super admin pages (only super_admin role)
        AdminDashboard.jsx         — All-clients overview
        ClientList.jsx             — List/manage clients
        ClientCreate.jsx           — Onboarding form: create client + deploy agent
        ClientDetail.jsx           — Edit client, prompt, view their data
        TemplateList.jsx           — Prompt templates library
        Logs.jsx                   — System logs viewer with filters, search, auto-refresh
      /dashboard                   — Client-facing pages (admin + staff roles)
        Dashboard.jsx              — Stats, recent leads, activity, appointments
        Leads.jsx                  — Filterable leads table
        LeadDetail.jsx             — Contact, timeline, messaging, notes, calls
        Appointments.jsx           — Appointments list with actions
        Staff.jsx                  — Manage staff (admin role only)
        Settings.jsx               — Firm settings, CRM config (admin role only)
    /components
      Sidebar.jsx                  — Dynamic: admin panel nav vs client nav
      TopBar.jsx                   — Search, notifications, user menu
      StatsCard.jsx                — Dashboard stat card
      ScoreBadge.jsx               — Lead score pill (hot/warm/cold)
      StatusBadge.jsx              — Status pill (new/contacted/booked/etc)
      ActivityFeed.jsx             — Activity timeline
      DateFilter.jsx               — Date range filter
      MessageComposer.jsx          — SMS/email/note composer on LeadDetail
      MessageTimeline.jsx          — Unified timeline (calls + SMS + email + notes)
      MessageTemplateSelector.jsx  — Quick-reply template picker
      StaffCard.jsx                — Staff member card with active/inactive toggle
      AgentDeliveryPanel.jsx       — Phone number + widget embed code display
    /services
      api.js                       — API client (fetch wrapper with auth headers)

/supabase
  /migrations
    001_initial_schema.sql         — Existing (will be replaced)
    002_add_call_notes_and_fields.sql — Existing (will be merged)
    003_multi_tenant_schema.sql    — NEW: full multi-tenant schema (see Section 3)
```

---

## 3. Database Schema (Exact SQL)

This replaces all existing migrations. Run as a single migration `003_multi_tenant_schema.sql`.

```sql
-- ============================================================
-- LeapingAI Multi-Tenant Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. FIRMS (your clients)
CREATE TABLE firms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  industry        TEXT NOT NULL DEFAULT 'other',
  -- options: 'legal', 'dental', 'plumbing', 'real_estate', 'medical', 'other'
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  website         TEXT,
  logo_url        TEXT,
  brand_color     TEXT DEFAULT '#6d28d9',
  business_hours  TEXT DEFAULT '9:00 AM - 5:00 PM, Monday - Friday',

  -- Retell AI
  retell_agent_id       TEXT,          -- Retell agent ID
  retell_phone_number   TEXT,          -- assigned phone number
  agent_name            TEXT DEFAULT 'Sarah',
  agent_voice_id        TEXT,          -- Retell voice ID

  -- Prompt
  prompt_template_id    UUID,          -- FK to prompt_templates
  rendered_prompt       TEXT,          -- final prompt with variables filled

  -- CRM integration
  crm_mode        TEXT DEFAULT 'builtin',  -- 'builtin' | 'external' | 'both'
  crm_type        TEXT,                     -- 'webhook' | 'hubspot' | 'salesforce' | null
  crm_webhook_url TEXT,
  crm_api_key     TEXT,                     -- encrypted in practice
  crm_access_token TEXT,                    -- OAuth token for native CRMs
  crm_field_mapping JSONB DEFAULT '{}',     -- field mapping config

  -- Plan & status
  plan            TEXT DEFAULT 'free',      -- 'free' | 'starter' | 'pro' | 'enterprise'
  status          TEXT DEFAULT 'active',    -- 'active' | 'paused' | 'cancelled'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (login accounts — your admins + client staff)
CREATE TABLE users (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id   UUID REFERENCES firms(id) ON DELETE CASCADE,
  email     TEXT UNIQUE NOT NULL,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'admin',
  -- 'super_admin' = you (firm_id is NULL)
  -- 'admin'       = client owner
  -- 'staff'       = client team member
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STAFF (attorneys, doctors, technicians — appear in AI prompt)
CREATE TABLE staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT,              -- 'attorney', 'doctor', 'technician', etc.
  specialization  TEXT,              -- 'Family Law', 'Orthodontics', etc.
  email           TEXT,
  phone           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  calendar_id     TEXT,              -- Google Calendar ID for this person
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROMPT TEMPLATES (industry-level, shared)
CREATE TABLE prompt_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,             -- 'Legal - Family Law'
  industry    TEXT NOT NULL,             -- 'legal', 'dental', etc.
  body        TEXT NOT NULL,             -- template with {{variables}}
  variables   JSONB DEFAULT '[]',        -- list of variable names used
  intake_questions JSONB DEFAULT '[]',   -- industry-specific questions
  case_types  JSONB DEFAULT '[]',        -- e.g. ['divorce','custody','support']
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INDUSTRY CONFIG (labels per industry for white-labeling)
CREATE TABLE industry_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry        TEXT UNIQUE NOT NULL,
  lead_label      TEXT DEFAULT 'Leads',          -- 'Patient Inquiries' for dental
  case_label      TEXT DEFAULT 'Case Type',      -- 'Treatment Type' for dental
  staff_label     TEXT DEFAULT 'Staff',          -- 'Doctor' for dental
  case_types      JSONB DEFAULT '[]',            -- dropdown options
  score_weights   JSONB DEFAULT '{}',            -- industry-specific scoring
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LEADS
CREATE TABLE leads (
  id                TEXT PRIMARY KEY,             -- 'lead_1710500000000'
  firm_id           UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  caller_name       TEXT NOT NULL DEFAULT 'Unknown Caller',
  caller_phone      TEXT,
  caller_email      TEXT,
  case_type         TEXT DEFAULT 'other',
  urgency           TEXT DEFAULT 'low',           -- 'low' | 'medium' | 'high'
  score             INTEGER DEFAULT 0,
  score_label       TEXT DEFAULT 'cold',          -- 'hot' | 'warm' | 'cold'
  status            TEXT DEFAULT 'new',
  -- status flow: 'new' → 'contacted' → 'booked' → 'converted' → 'closed'
  notes             TEXT,                          -- AI-generated summary
  call_notes        JSONB DEFAULT '[]',            -- manual notes (legacy, migrate to messages)
  appointment_booked BOOLEAN DEFAULT FALSE,
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  follow_up_date    DATE,
  sentiment         TEXT,                          -- 'positive' | 'neutral' | 'negative' | 'distressed'
  source            TEXT DEFAULT 'phone',          -- 'phone' | 'widget' | 'whatsapp' | 'sms'
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CALLS
CREATE TABLE calls (
  id              TEXT PRIMARY KEY,
  lead_id         TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  retell_call_id  TEXT,                           -- Retell's call ID
  transcript      TEXT,
  summary         TEXT,
  recording_url   TEXT,
  duration        INTEGER DEFAULT 0,              -- seconds
  ended_reason    TEXT,
  sentiment       TEXT,                            -- post-call LLM analysis
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. APPOINTMENTS
CREATE TABLE appointments (
  id                TEXT PRIMARY KEY,
  lead_id           TEXT REFERENCES leads(id) ON DELETE SET NULL,
  firm_id           UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  caller_name       TEXT,
  caller_phone      TEXT,
  caller_email      TEXT,
  case_type         TEXT,
  appointment_date  TEXT,                          -- 'YYYY-MM-DD'
  appointment_time  TEXT,                          -- '2:30 PM'
  assigned_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  urgency           TEXT DEFAULT 'low',
  notes             TEXT,
  status            TEXT DEFAULT 'confirmed',      -- 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  google_event_id   TEXT,                          -- Google Calendar event ID
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 9. INTAKE ANSWERS (structured Q&A from AI call)
CREATE TABLE intake_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     TEXT REFERENCES calls(id) ON DELETE CASCADE,
  lead_id     TEXT REFERENCES leads(id) ON DELETE CASCADE,
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 10. MESSAGES (SMS, email, internal notes — unified timeline)
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL,                       -- 'outbound' | 'inbound'
  channel     TEXT NOT NULL,                       -- 'sms' | 'email' | 'note' | 'whatsapp'
  sender      TEXT,                                -- staff name, 'AI', 'System', or phone number
  sender_id   UUID REFERENCES users(id),           -- null for inbound or system
  body        TEXT NOT NULL,
  subject     TEXT,                                -- email subject (null for SMS/notes)
  status      TEXT DEFAULT 'sent',                 -- 'sent' | 'delivered' | 'failed' | 'received'
  external_id TEXT,                                -- Twilio SID or Resend ID
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MESSAGE TEMPLATES (quick-reply templates)
CREATE TABLE message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID REFERENCES firms(id) ON DELETE CASCADE,  -- null = global template
  industry    TEXT,                                           -- industry-level defaults
  name        TEXT NOT NULL,                                  -- 'Confirm Appointment'
  channel     TEXT NOT NULL DEFAULT 'sms',                    -- 'sms' | 'email'
  subject     TEXT,                                           -- email subject template
  body        TEXT NOT NULL,                                  -- template with {{name}}, {{date}}, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_leads_firm_id ON leads(firm_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_score_label ON leads(score_label);
CREATE INDEX idx_calls_lead_id ON calls(lead_id);
CREATE INDEX idx_calls_firm_id ON calls(firm_id);
CREATE INDEX idx_appointments_firm_id ON appointments(firm_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_firm_id ON messages(firm_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_staff_firm_id ON staff(firm_id);
CREATE INDEX idx_intake_answers_lead_id ON intake_answers(lead_id);
CREATE INDEX idx_users_firm_id ON users(firm_id);
CREATE INDEX idx_firms_retell_agent_id ON firms(retell_agent_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Super admins see all
CREATE POLICY "super_admin_all" ON firms FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);
CREATE POLICY "super_admin_all" ON leads FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);
-- (same pattern for all tables)

-- Firm members see own data
CREATE POLICY "firm_isolation" ON leads FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
CREATE POLICY "firm_isolation" ON calls FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
CREATE POLICY "firm_isolation" ON appointments FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
CREATE POLICY "firm_isolation" ON messages FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
CREATE POLICY "firm_isolation" ON staff FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
CREATE POLICY "firm_isolation" ON intake_answers FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Industry configs
INSERT INTO industry_configs (industry, lead_label, case_label, staff_label, case_types) VALUES
  ('legal', 'Leads', 'Case Type', 'Attorney', '["divorce","custody","support","domestic_violence","paternity","adoption","other"]'),
  ('dental', 'Patient Inquiries', 'Treatment Type', 'Doctor', '["cleaning","filling","root_canal","whitening","braces","extraction","consultation","other"]'),
  ('plumbing', 'Service Requests', 'Job Type', 'Technician', '["leak_repair","drain_cleaning","water_heater","pipe_replacement","emergency","inspection","other"]'),
  ('real_estate', 'Inquiries', 'Property Type', 'Agent', '["buying","selling","rental","commercial","consultation","other"]');

-- Default prompt templates
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
- If caller insists on speaking to a human, use transfer_call
- Keep conversation under 8 minutes
- At end of call, use save_intake_data to store structured answers',
   '["divorce","custody","support","domestic_violence","paternity","adoption","other"]'),

  ('Dental - General', 'dental',
   'You are {{agent_name}}, a friendly AI receptionist for {{company_name}}.

AVAILABLE DOCTORS:
{{active_staff}}

BUSINESS HOURS: {{business_hours}}

YOUR JOB:
1. Greet warmly
2. Ask their name and phone number
3. Ask what dental service they need
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
   '["cleaning","filling","root_canal","whitening","braces","extraction","consultation","other"]');
```

---

## 4. Auth System & Role Matrix

### Authentication Flow

1. User visits `/login`
2. Enters email + password
3. Frontend calls `supabase.auth.signInWithPassword()`
4. Supabase returns JWT with `user.id`
5. Frontend stores session, sends JWT in `Authorization: Bearer <token>` header
6. Backend middleware verifies JWT, looks up user record, attaches `req.user` and `req.firm`

### Backend Auth Middleware

```js
// middleware/auth.js
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  // Fetch user record with role and firm_id
  const { data: dbUser } = await supabase
    .from('users')
    .select('*, firms(*)')
    .eq('id', user.id)
    .single();

  if (!dbUser) return res.status(401).json({ error: 'User not found' });

  req.user = dbUser;           // { id, email, name, role, firm_id }
  req.firm = dbUser.firms;     // { id, name, industry, ... } or null for super_admin
  next();
}

// middleware/requireRole.js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### Route Protection Matrix

| Route | Method | Roles Allowed | Notes |
|-------|--------|---------------|-------|
| `POST /api/auth/signup` | POST | Public | Super admin creates accounts |
| `POST /api/auth/login` | POST | Public | |
| `GET /api/auth/me` | GET | Any authenticated | Returns user + firm config |
| **Leads** | | | |
| `GET /api/leads` | GET | admin, staff | Auto-filtered by `req.firm.id` |
| `GET /api/leads/:id` | GET | admin, staff | Must belong to same firm |
| `PATCH /api/leads/:id` | PATCH | admin, staff | Allowlisted fields only |
| **Appointments** | | | |
| `GET /api/appointments` | GET | admin, staff | Auto-filtered by firm |
| `PATCH /api/appointments/:id` | PATCH | admin, staff | |
| **Messages** | | | |
| `GET /api/messages?lead_id=x` | GET | admin, staff | Messages for a lead |
| `POST /api/messages` | POST | admin, staff | Send SMS/email/note |
| **Staff** | | | |
| `GET /api/staff` | GET | admin, staff | |
| `POST /api/staff` | POST | admin | |
| `PATCH /api/staff/:id` | PATCH | admin | Triggers prompt re-render |
| `DELETE /api/staff/:id` | DELETE | admin | Soft delete (is_active=false) |
| **Firms (Admin Panel)** | | | |
| `GET /api/firms` | GET | super_admin | All clients |
| `POST /api/firms` | POST | super_admin | Create client + deploy agent |
| `GET /api/firms/:id` | GET | super_admin | Single client detail |
| `PATCH /api/firms/:id` | PATCH | super_admin | Edit client |
| **Templates (Admin Panel)** | | | |
| `GET /api/templates` | GET | super_admin | All prompt templates |
| `POST /api/templates` | POST | super_admin | |
| `PATCH /api/templates/:id` | PATCH | super_admin | |
| **Webhooks (No auth — validated differently)** | | | |
| `POST /api/retell/webhook` | POST | — | Validated via Retell signature |
| `POST /api/twilio/sms` | POST | — | Validated via Twilio signature |

### Field Allowlists for PATCH Routes

```js
// Leads: only these fields can be updated via PATCH
const LEAD_UPDATABLE = ['status', 'assigned_staff_id', 'follow_up_date', 'notes'];

// Appointments: only these fields
const APPOINTMENT_UPDATABLE = ['status', 'appointment_date', 'appointment_time', 'assigned_staff_id', 'notes'];

// Firms: super_admin can update these
const FIRM_UPDATABLE = [
  'name', 'industry', 'email', 'phone', 'address', 'website',
  'logo_url', 'brand_color', 'business_hours', 'agent_name',
  'agent_voice_id', 'prompt_template_id', 'crm_mode', 'crm_type',
  'crm_webhook_url', 'crm_api_key', 'plan', 'status'
];
```

---

## 5. API Contracts

Every endpoint with exact request/response shapes.

### Auth

```
POST /api/auth/login
  Request:  { "email": "admin@mitchellaw.com", "password": "..." }
  Response: { "user": { "id", "email", "name", "role", "firm_id" }, "session": { "access_token" } }

GET /api/auth/me
  Headers:  Authorization: Bearer <token>
  Response: {
    "id": "uuid",
    "email": "admin@mitchellaw.com",
    "name": "Mitchell Law",
    "role": "admin",
    "firm": {
      "id": "uuid",
      "name": "Mitchell Family Law",
      "industry": "legal",
      "brand_color": "#1d4ed8",
      "logo_url": "...",
      "business_hours": "9 AM - 5 PM",
      "retell_phone_number": "+14255550199",
      "agent_name": "Sarah",
      "crm_mode": "builtin",
      "plan": "pro",
      "status": "active"
    },
    "industry_config": {
      "lead_label": "Leads",
      "case_label": "Case Type",
      "staff_label": "Attorney",
      "case_types": ["divorce", "custody", "support", ...]
    }
  }
```

### Leads

```
GET /api/leads
  Headers:  Authorization: Bearer <token>
  Query:    ?status=new&score_label=hot&search=john&date_range=week
  Response: [
    {
      "id": "lead_171050000",
      "firm_id": "uuid",
      "caller_name": "John Smith",
      "caller_phone": "+14255551234",
      "caller_email": "john@email.com",
      "case_type": "divorce",
      "urgency": "high",
      "score": 85,
      "score_label": "hot",
      "status": "new",
      "notes": "AI summary...",
      "appointment_booked": true,
      "assigned_staff_id": "uuid" | null,
      "follow_up_date": "2026-03-20" | null,
      "source": "phone",
      "created_at": "2026-03-15T22:42:00Z"
    },
    ...
  ]

GET /api/leads/:id
  Response: {
    ...lead fields above...,
    "calls": [
      {
        "id": "call_171050000",
        "retell_call_id": "abc123",
        "transcript": "...",
        "summary": "...",
        "recording_url": "https://...",
        "duration": 245,
        "ended_reason": "agent_hangup",
        "sentiment": "distressed",
        "created_at": "2026-03-15T22:42:00Z"
      }
    ],
    "messages": [
      {
        "id": "uuid",
        "direction": "outbound",
        "channel": "sms",
        "sender": "Attorney Mitchell",
        "body": "Hi John, confirming your consultation...",
        "status": "delivered",
        "created_at": "2026-03-16T09:15:00Z"
      },
      {
        "id": "uuid",
        "direction": "inbound",
        "channel": "sms",
        "sender": "+14255551234",
        "body": "Thank you! I'll be there.",
        "status": "received",
        "created_at": "2026-03-16T09:22:00Z"
      }
    ],
    "intake_answers": [
      { "question": "Divorce papers filed?", "answer": "No" },
      { "question": "Children involved?", "answer": "Yes, 2 children ages 5 and 8" }
    ],
    "assigned_staff": { "id": "uuid", "name": "Attorney Mitchell", "specialization": "Family Law" } | null
  }

PATCH /api/leads/:id
  Request:  { "status": "contacted" }
  Allowed fields: status, assigned_staff_id, follow_up_date, notes
  Response: { ...updated lead }
```

### Messages

```
GET /api/messages?lead_id=lead_171050000
  Response: [
    { "id", "direction", "channel", "sender", "body", "status", "created_at" },
    ...
  ]

POST /api/messages
  Request: {
    "lead_id": "lead_171050000",
    "channel": "sms",           // 'sms' | 'email' | 'note'
    "body": "Hi John, confirming your consultation...",
    "subject": null              // required for email only
  }
  Response: { "id", "direction": "outbound", "channel": "sms", "status": "sent", ... }
  Side effects:
    - If channel=sms: sends via Twilio, stores twilio SID
    - If channel=email: sends via Resend, stores resend ID
    - If channel=note: just saves to DB (internal only)
```

### Staff

```
GET /api/staff
  Response: [
    { "id", "name", "role", "specialization", "email", "phone", "is_active", "calendar_id" },
    ...
  ]

POST /api/staff
  Request: { "name": "Dr. Patel", "role": "doctor", "specialization": "Oral Surgery", "email": "...", "is_active": true }
  Response: { ...staff record }
  Side effects: triggers prompt re-render + Retell agent update

PATCH /api/staff/:id
  Request: { "is_active": false }
  Response: { ...updated staff }
  Side effects: triggers prompt re-render + Retell agent update

DELETE /api/staff/:id
  Soft delete: sets is_active=false
  Side effects: triggers prompt re-render + Retell agent update
```

### Firms (Super Admin)

```
GET /api/firms
  Response: [
    { "id", "name", "industry", "status", "plan", "retell_phone_number", "agent_name", "created_at",
      "_counts": { "leads": 45, "appointments": 12, "staff": 3 }
    },
    ...
  ]

POST /api/firms
  Request: {
    "name": "Bright Smile Dental",
    "industry": "dental",
    "email": "info@brightsmile.com",
    "phone": "+14255550100",
    "address": "123 Main St",
    "business_hours": "9 AM - 6 PM, Mon-Fri",
    "agent_name": "Amy",
    "agent_voice_id": "11labs_voice_id",
    "prompt_template_id": "uuid",
    "brand_color": "#059669",
    "staff": [
      { "name": "Dr. Sarah Chen", "role": "doctor", "specialization": "Orthodontics" },
      { "name": "Dr. Mike Ross", "role": "doctor", "specialization": "General" }
    ],
    "admin_email": "admin@brightsmile.com",
    "admin_name": "Dr. Chen"
  }
  Response: { ...firm record with retell_agent_id and retell_phone_number }
  Side effects:
    1. Save firm to DB
    2. Save staff records
    3. Render prompt template with variables
    4. POST to Retell API: create agent with rendered prompt
    5. Assign phone number via Retell API
    6. Create admin user account (Supabase Auth)
    7. Save retell_agent_id + phone back to firm record
```

### Appointments

```
GET /api/appointments
  Query:    ?status=confirmed&date_range=week
  Response: [ { ...appointment fields }, ... ]

PATCH /api/appointments/:id
  Request:  { "status": "completed" }
  Allowed fields: status, appointment_date, appointment_time, assigned_staff_id, notes
  Response: { ...updated appointment }
```

### Templates (Super Admin)

```
GET /api/templates
  Response: [ { "id", "name", "industry", "body", "variables", "case_types" }, ... ]

POST /api/templates
  Request: { "name": "Dental - Pediatric", "industry": "dental", "body": "You are {{agent_name}}...", "case_types": [...] }
  Response: { ...template }

PATCH /api/templates/:id
  Request: { "body": "updated template..." }
  Response: { ...updated template }
```

---

## 6. Retell AI Integration

### Authentication

All Retell API calls use header: `Authorization: Bearer <RETELL_API_KEY>`

Base URL: `https://api.retellai.com`

Webhook signature verification header: `x-retell-signature`
```js
const Retell = require('retell-sdk');
const isValid = Retell.verify(
  JSON.stringify(req.body),
  process.env.RETELL_API_KEY,
  req.headers['x-retell-signature']
);
```

### API Endpoints Reference

| Operation | Method | Path |
|-----------|--------|------|
| Create Agent | POST | `/v2/create-agent` |
| Update Agent | PATCH | `/v2/update-agent/{agent_id}` |
| Get Agent | GET | `/v2/get-agent/{agent_id}` |
| List Agents | GET | `/v2/list-agents` |
| Create Phone Number | POST | `/v2/create-phone-number` |
| Import Phone Number | POST | `/v2/import-phone-number` |
| Get Phone Number | GET | `/v2/get-phone-number/{phone_number}` |
| Create Web Call | POST | `/v2/create-web-call` |
| Create Phone Call | POST | `/v2/create-phone-call` |
| Get Call | GET | `/v2/get-call/{call_id}` |
| List Calls | GET | `/v2/list-calls` |

### Create Agent

```
POST https://api.retellai.com/v2/create-agent
Headers: Authorization: Bearer <RETELL_API_KEY>

Request (required fields):
{
  "response_engine": {
    "type": "retell-llm",
    "llm_id": "llm_234sdertfsdsfsdf"
  },
  "voice_id": "11labs-Adrian"
}

Request (with all fields we use):
{
  "agent_name": "Amy - Bright Smile Dental",
  "response_engine": {
    "type": "retell-llm",
    "llm_id": "llm_xxxx"
  },
  "voice_id": "11labs-Adrian",
  "language": "en-US",
  "webhook_url": "https://yourapp.render.com/api/retell/webhook",
  "webhook_events": ["call_started", "call_ended", "call_analyzed"],
  "responsiveness": 0.5,
  "interruption_sensitivity": 0.5,
  "voice_temperature": 0.5,
  "voice_speed": 1.0,
  "enable_backchannel": true,
  "reminder_trigger_ms": 10000,
  "reminder_max_count": 2,
  "post_call_analysis": [
    { "type": "Text", "name": "call_summary", "description": "Summarize the call in 2-3 sentences" },
    { "type": "Selector", "name": "user_sentiment", "description": "Caller sentiment", "choices": ["Positive", "Neutral", "Negative", "Distressed"] }
  ]
}

Response:
{
  "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
  "version": 1,
  "agent_name": "Amy - Bright Smile Dental",
  "response_engine": { "type": "retell-llm", "llm_id": "llm_xxxx", "version": 1 },
  "voice_id": "11labs-Adrian",
  "is_published": false,
  "last_modification_timestamp": 1714608475945,
  ...all optional fields that were set
}
```

> **Note**: The `general_prompt` is set on the **Retell LLM resource** (llm_id), not on the agent directly. To update a prompt, you update the LLM. To create a new agent with a prompt, first create an LLM with the prompt, then reference its `llm_id` in the agent.

### Update Agent

```
PATCH https://api.retellai.com/v2/update-agent/{agent_id}
Body: any optional agent fields (voice_id, webhook_url, agent_name, etc.)
Response: full updated agent object
```

### Create Phone Number

```
POST https://api.retellai.com/v2/create-phone-number
Body: {
  "area_code": 425,
  "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
  "nickname": "Bright Smile Dental"
}
Response: {
  "phone_number": "+14257774444",
  "phone_number_pretty": "(425) 777-4444",
  "type": "...",
  "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
  "last_modification_timestamp": 1714608475945
}
```

### Create Web Call (for website widget — custom SDK approach)

```
POST https://api.retellai.com/v2/create-web-call
Body: {
  "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD"
}
Response: {
  "call_type": "web_call",
  "call_id": "...",
  "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
  "agent_version": 1,
  "access_token": "JWT_TOKEN_HERE",
  "call_status": "registered"
}
```
> access_token expires after **30 seconds** if call is not started.

### Webhook Events (Retell → Your Server)

All events POST to: `POST /api/retell/webhook`
Verify with: `x-retell-signature` header.
Three events per call, all share the same `call_id`:

**1. call_started** — fired when call begins:
```json
{
  "event": "call_started",
  "call": {
    "call_type": "phone_call",
    "call_id": "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
    "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
    "call_status": "registered",
    "from_number": "+12137771234",
    "to_number": "+12137771235",
    "direction": "inbound",
    "metadata": {},
    "retell_llm_dynamic_variables": { "customer_name": "John Doe" },
    "start_timestamp": 1714608475945
  }
}
```

**2. call_ended** — fired when call ends, is transferred, or errors:
```json
{
  "event": "call_ended",
  "call": {
    "call_type": "phone_call",
    "call_id": "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
    "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
    "call_status": "ended",
    "from_number": "+12137771234",
    "to_number": "+12137771235",
    "direction": "inbound",
    "metadata": {},
    "start_timestamp": 1714608475945,
    "end_timestamp": 1714608491736,
    "disconnection_reason": "user_hangup",
    "transcript": "Agent: Hello, thank you for calling...\nUser: I need help with...",
    "transcript_object": [
      { "role": "agent", "content": "Hello, thank you for calling...", "words": [...] },
      { "role": "user", "content": "I need help with...", "words": [...] }
    ],
    "transcript_with_tool_calls": [...]
  }
}
```

Key `disconnection_reason` values:
- `user_hangup` — caller hung up
- `agent_hangup` — agent ended the call
- `call_transfer` — call was transferred
- `voicemail_reached` — went to voicemail
- `inactivity` — no activity timeout
- `max_duration_reached` — call hit max length
- `dial_busy`, `dial_failed`, `dial_no_answer` — outbound dial failures
- `error_*` — various error conditions

**3. call_analyzed** — fired after post-call analysis completes:
```json
{
  "event": "call_analyzed",
  "call": {
    "call_id": "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
    "call_analysis": {
      "call_summary": "Caller needs divorce attorney. Papers not filed. 2 children ages 5 and 8. Booked for Mar 17 at 2 PM.",
      "user_sentiment": "Negative",
      "call_completion_status": "Complete",
      "task_completion_status": "Completed",
      "custom_analysis_data": { ... }
    }
  }
}
```

### Webhook Handler Logic

```
call_started → Log call start. Optional: create a "call in progress" record.

call_ended → Main processing:
  1. Verify x-retell-signature
  2. Extract agent_id → look up firm: SELECT * FROM firms WHERE retell_agent_id = call.agent_id
  3. Extract from_number, transcript, recording_url, disconnection_reason
  4. Calculate duration: (end_timestamp - start_timestamp) / 1000
  5. Check if appointment was booked during call (check recent appointments by phone)
  6. Calculate lead score
  7. INSERT lead record (firm_id, caller_phone, case_type, score, etc.)
  8. INSERT call record (lead_id, transcript, duration, recording_url, etc.)
  9. If appointment booked: UPDATE appointment SET lead_id = new_lead_id
  10. Send booking confirmation SMS if appointment was booked
  11. Push to external CRM if configured
  12. Return 200

call_analyzed → Enrichment:
  1. Extract call_analysis.call_summary and call_analysis.user_sentiment
  2. UPDATE calls SET summary = call_summary, sentiment = user_sentiment WHERE retell_call_id = call_id
  3. UPDATE leads SET notes = call_summary, sentiment = user_sentiment WHERE id = lead_id
  4. Return 200
```

### Tool Calls / Custom Functions (Mid-Call)

Retell sends tool calls to your function endpoint (configured per-tool in Retell dashboard). Each tool has its own URL.

**Request Retell sends to your server:**
```json
{
  "call": {
    "call_type": "phone_call",
    "from_number": "+12137771234",
    "to_number": "+12137771235",
    "direction": "inbound",
    "call_id": "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
    "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
    "call_status": "registered",
    "metadata": {},
    "retell_llm_dynamic_variables": { "customer_name": "John Doe" }
  },
  "name": "check_availability",
  "args": {
    "date": "2026-03-17"
  }
}
```

**Your server responds (HTTP 200, any JSON/string):**
```json
{
  "available": true,
  "date": "2026-03-17",
  "slots": ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM", "4:00 PM"],
  "message": "We have the following times available on March 17: 9:00 AM, 10:30 AM, 1:00 PM, 2:30 PM, 4:00 PM"
}
```

The response body is fed back to the LLM as the tool result. Verify with `X-Retell-Signature` header. Default timeout: 2 minutes, retries up to 2 times on failure.

**Tool endpoints to create:**
```
POST /api/retell/tool/check-availability
POST /api/retell/tool/book-appointment
POST /api/retell/tool/save-intake-data
```

### Tools to Register in Retell Dashboard

| Tool Name | Server URL | Parameters | Purpose |
|-----------|-----------|-----------|---------|
| `check_availability` | `https://yourapp.render.com/api/retell/tool/check-availability` | `date` (string, YYYY-MM-DD) | Check Google Calendar for open slots |
| `book_appointment` | `https://yourapp.render.com/api/retell/tool/book-appointment` | `caller_name`, `caller_phone`, `caller_email`, `case_type`, `appointment_date`, `appointment_time`, `urgency`, `notes` | Book consultation |
| `save_intake_data` | `https://yourapp.render.com/api/retell/tool/save-intake-data` | Dynamic key/value pairs based on industry | Store structured Q&A in intake_answers |

### Website Widget — Two Approaches

**Approach A: Retell Widget Embed (no-code, script tag)**
```html
<script id="retell-widget"
  src="https://dashboard.retellai.com/retell-widget.js"
  type="module"
  data-public-key="YOUR_RETELL_PUBLIC_KEY"
  data-agent-id="YOUR_AGENT_ID"
  data-agent-version="1"
  data-title="Bright Smile Dental"
  data-logo-url="https://example.com/logo.png"
  data-color="#059669"
  data-bot-name="Amy"
  data-popup-message="Hi! Need to book an appointment?"
  data-show-ai-popup="true"
  data-show-ai-popup-time="5"
  data-auto-open="false">
</script>
```

**Approach B: Custom SDK (full control over UI)**
```bash
npm install retell-client-js-sdk
```

Server creates a web call → returns access_token → frontend starts call:
```js
// Frontend
import { RetellWebClient } from 'retell-client-js-sdk';

const retellClient = new RetellWebClient();

retellClient.on('conversationStarted', () => { /* show speaking UI */ });
retellClient.on('conversationEnded', () => { /* show ended UI */ });
retellClient.on('error', (error) => { /* handle error */ });

// Get access_token from your backend first
const res = await fetch('/api/retell/web-call', { method: 'POST', body: JSON.stringify({ agent_id }) });
const { access_token } = await res.json();

retellClient.startCall({
  accessToken: access_token,
  sampleRate: 24000,
});
```

> For our platform: use **Approach A** (widget embed) for simplicity. Generate the embed code per-client with their agent_id, brand color, logo, bot name. Display it in the Agent Delivery panel for client to copy.

---

## 7. Twilio / Messaging Integration

### Outbound SMS (Dashboard → Customer)

```
POST /api/messages { lead_id, channel: "sms", body: "Hi John..." }
  → Backend: look up lead's phone number
  → Twilio API: POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
    Body: { To: lead.caller_phone, From: firm.retell_phone_number, Body: message.body }
  → Save to messages table with twilio SID
  → Return message record to frontend
```

### Inbound SMS (Customer → Dashboard)

```
Customer texts the firm's phone number
  → Twilio POSTs to: POST /api/twilio/sms
  → Payload: { From: "+14255551234", To: "+14255550199", Body: "Thank you!" }
  → Backend:
    1. Validate Twilio signature (security)
    2. Match From number → find lead by caller_phone
    3. Match To number → find firm by retell_phone_number
    4. Save inbound message to messages table
    5. (Supabase Realtime will push to dashboard in real-time)
  → Return TwiML: <Response></Response> (empty = no auto-reply)
```

### Automated Messages (Cron / Event-triggered)

| Trigger | Timing | Message |
|---------|--------|---------|
| Appointment booked | Immediately after booking | Confirmation SMS + email |
| 24h before appointment | Cron checks daily | Reminder SMS |
| 1h before appointment | Cron checks hourly | Final reminder SMS |
| Missed call (no answer) | On `ended_reason = "no_answer"` | "We missed your call, we'll call back" |
| No-show | 2h after appointment time | "We missed you, want to reschedule?" |

---

## 8. CRM Push Integration

### When to Push

Push happens in `crmPushController.js` after:
1. New lead created (from webhook)
2. Appointment booked (from webhook tool call)

### Push Logic

```js
async function maybePushToCRM(firm, lead, call, appointment) {
  if (firm.crm_mode === 'builtin') return; // no push needed

  if (firm.crm_type === 'webhook') {
    await pushViaWebhook(firm, lead, call, appointment);
  } else if (firm.crm_type === 'hubspot') {
    await pushToHubSpot(firm, lead, call, appointment);
  } else if (firm.crm_type === 'salesforce') {
    await pushToSalesforce(firm, lead, call, appointment);
  }
}
```

### Webhook Payload Shape

```json
{
  "event": "new_lead",
  "timestamp": "2026-03-15T22:42:00Z",
  "firm": { "id": "uuid", "name": "Bright Smile Dental" },
  "lead": {
    "id": "lead_xxx",
    "name": "John Smith",
    "phone": "+14255551234",
    "email": "john@email.com",
    "service_type": "root_canal",
    "urgency": "high",
    "score": 85,
    "score_label": "hot",
    "summary": "Patient has severe pain, upper right molar...",
    "transcript_url": "https://yourapp.com/api/calls/xxx/transcript",
    "recording_url": "https://storage.retellai.com/recordings/xxx.wav"
  },
  "appointment": {
    "date": "2026-03-17",
    "time": "10:00 AM",
    "staff": "Dr. Mike Ross",
    "status": "confirmed"
  } | null
}
```

---

## 9. Prompt Renderer

The `promptRenderer.js` service takes a template and fills in `{{variables}}`:

```js
function renderPrompt(template, firm, activeStaff) {
  let prompt = template.body;

  const staffList = activeStaff
    .map(s => `- ${s.name} (${s.specialization || s.role})`)
    .join('\n');

  const replacements = {
    '{{agent_name}}': firm.agent_name,
    '{{company_name}}': firm.name,
    '{{business_hours}}': firm.business_hours,
    '{{active_staff}}': staffList || 'No staff currently available',
    '{{phone}}': firm.phone,
    '{{address}}': firm.address || '',
    '{{services}}': template.case_types?.join(', ') || '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replaceAll(key, value);
  }

  return prompt;
}
```

**When to re-render and push to Retell:**
- Staff added/removed/toggled active
- Firm name/hours changed
- Template edited
- Any variable source changes

---

## 10. Logging System

A structured logging system that captures every important event, error, and API interaction. Logs are stored in the database and viewable in the super admin panel.

### Log Levels

| Level | When to Use | Color in Admin UI |
|-------|-------------|-------------------|
| `error` | Unhandled exceptions, failed API calls, DB errors, payment failures | Red |
| `warn` | Retries, fallback behavior, deprecated usage, slow queries | Amber |
| `info` | Successful operations: lead created, call ended, SMS sent, agent deployed | Blue |
| `debug` | Request/response bodies, full payloads, timing info (dev only) | Gray |

### What Gets Logged

| Category | Events Logged | Level |
|----------|--------------|-------|
| **Retell Webhook** | call_started, call_ended, call_analyzed received | info |
| **Retell Webhook** | Invalid payload, missing fields, signature verification failed | error |
| **Retell API** | Agent created, agent updated, phone number assigned | info |
| **Retell API** | API call failed, timeout, rate limit | error |
| **Tool Calls** | check_availability called, book_appointment called, save_intake_data called | info |
| **Tool Calls** | Tool execution failed, timeout, invalid args | error |
| **Lead Scoring** | Lead created with score + label | info |
| **Google Calendar** | Slots fetched, event created, event updated | info |
| **Google Calendar** | Calendar API error, auth failure | error |
| **Twilio SMS** | SMS sent, SMS received, delivery status update | info |
| **Twilio SMS** | Send failed, invalid number, Twilio API error | error |
| **Email** | Email sent, delivery confirmed | info |
| **Email** | Send failed, bounce, invalid address | error |
| **CRM Push** | Data pushed to webhook/HubSpot/Salesforce | info |
| **CRM Push** | Push failed, auth error, rate limit | error |
| **Auth** | Login success, login failure, token expired | info/warn |
| **Admin** | Client created, client paused, agent deployed, prompt updated | info |
| **Database** | Query error, constraint violation, connection lost | error |
| **System** | Server started, server crashed, scheduled job ran | info/error |

### Database Table

```sql
-- 12. SYSTEM LOGS
CREATE TABLE system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID REFERENCES firms(id) ON DELETE SET NULL,  -- null for system-level logs
  level       TEXT NOT NULL,              -- 'error' | 'warn' | 'info' | 'debug'
  category    TEXT NOT NULL,              -- 'retell_webhook' | 'retell_api' | 'tool_call' | 'sms' | 'email' | 'crm_push' | 'auth' | 'admin' | 'calendar' | 'system'
  message     TEXT NOT NULL,              -- human-readable: "Lead created: John Smith (score: 85)"
  details     JSONB DEFAULT '{}',         -- full context: request body, response, error stack, etc.
  source      TEXT,                       -- file/function: "webhookController.handleCallEnded"
  call_id     TEXT,                       -- Retell call ID if related to a call
  lead_id     TEXT,                       -- Lead ID if related to a lead
  user_id     UUID,                       -- User who triggered (null for system/webhook)
  ip_address  TEXT,                       -- request IP
  duration_ms INTEGER,                    -- how long the operation took
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_firm_id ON system_logs(firm_id);
CREATE INDEX idx_logs_level ON system_logs(level);
CREATE INDEX idx_logs_category ON system_logs(category);
CREATE INDEX idx_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_logs_call_id ON system_logs(call_id);

-- RLS: super_admin sees all, firm members see own firm's logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all" ON system_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);

CREATE POLICY "firm_isolation" ON system_logs FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
```

### Logger Service

```js
// server/services/logger.js

const supabase = require('./supabase');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';

async function log(level, category, message, opts = {}) {
  const { firmId, details, source, callId, leadId, userId, ip, durationMs } = opts;

  // Always console.log
  const prefix = `[${level.toUpperCase()}] [${category}]`;
  console.log(`${prefix} ${message}`, details ? JSON.stringify(details).slice(0, 500) : '');

  // Skip DB write for debug in production
  if (LOG_LEVELS[level] > LOG_LEVELS[CURRENT_LEVEL]) return;

  // Write to database (non-blocking — don't await in hot paths)
  if (supabase) {
    supabase.from('system_logs').insert({
      firm_id: firmId || null,
      level,
      category,
      message,
      details: details || {},
      source: source || null,
      call_id: callId || null,
      lead_id: leadId || null,
      user_id: userId || null,
      ip_address: ip || null,
      duration_ms: durationMs || null,
    }).then(({ error }) => {
      if (error) console.error('[Logger DB Error]', error.message);
    });
  }
}

// Convenience methods
const logger = {
  error: (category, message, opts) => log('error', category, message, opts),
  warn:  (category, message, opts) => log('warn', category, message, opts),
  info:  (category, message, opts) => log('info', category, message, opts),
  debug: (category, message, opts) => log('debug', category, message, opts),
};

module.exports = logger;
```

### Usage Examples

```js
// In webhookController.js
const logger = require('../services/logger');

async function handleCallEnded(call) {
  const start = Date.now();

  logger.info('retell_webhook', `Call ended: ${call.call_id}`, {
    callId: call.call_id,
    details: { from: call.from_number, reason: call.disconnection_reason },
    source: 'webhookController.handleCallEnded',
  });

  // ... process call ...

  logger.info('lead_scoring', `Lead created: ${lead.caller_name} (score: ${score})`, {
    firmId: lead.firm_id,
    leadId: lead.id,
    callId: call.call_id,
    details: { score, scoreLabel, caseType: lead.case_type },
    durationMs: Date.now() - start,
  });
}

// In retell.js (API calls)
async function createAgent(opts) {
  try {
    const result = await retellFetch('/v2/create-agent', { ... });
    logger.info('retell_api', `Agent created: ${result.agent_id}`, {
      firmId: opts.firmId,
      details: { agentId: result.agent_id, agentName: opts.agentName },
    });
    return result;
  } catch (err) {
    logger.error('retell_api', `Failed to create agent: ${err.message}`, {
      firmId: opts.firmId,
      details: { error: err.message, stack: err.stack, request: opts },
    });
    throw err;
  }
}

// In messageController.js
logger.info('sms', `SMS sent to ${lead.caller_phone}`, {
  firmId: firm.id,
  leadId: lead.id,
  details: { to: lead.caller_phone, twilioSid: result.sid },
});

// On unhandled error
logger.error('system', `Unhandled error: ${err.message}`, {
  details: { error: err.message, stack: err.stack, url: req.url },
  ip: req.ip,
});
```

### Admin Panel — Logs Page

```
/admin/logs — Super admin only

┌─────────────────────────────────────────────────────────────────┐
│  System Logs                                    [Auto-refresh ✓]│
│                                                                  │
│  Filters:                                                        │
│  Level: [All ▼]  Category: [All ▼]  Client: [All ▼]            │
│  Date: [Last 24h ▼]  Search: [________________________]         │
│                                                                  │
│  ┌─────────┬──────────┬──────────┬──────────────────────────┐   │
│  │ Level   │ Category │ Client   │ Message                  │   │
│  ├─────────┼──────────┼──────────┼──────────────────────────┤   │
│  │ 🔴 error│ sms      │ Mitchell │ SMS failed: invalid num  │   │
│  │ 🟢 info │ webhook  │ Bright S │ Call ended: call_abc123  │   │
│  │ 🟢 info │ lead     │ Bright S │ Lead created: John (85)  │   │
│  │ 🟡 warn │ calendar │ Mitchell │ Calendar API slow: 3.2s  │   │
│  │ 🔴 error│ crm_push │ ABC Plmb │ HubSpot push failed: 401│   │
│  │ 🟢 info │ admin    │ —        │ Client created: Bright S │   │
│  │ 🟢 info │ retell   │ Bright S │ Agent deployed: agent_x  │   │
│  └─────────┴──────────┴──────────┴──────────────────────────┘   │
│                                                                  │
│  Click any row → expands to show full details JSON               │
│                                                                  │
│  ── Error Summary (last 24h) ────────────────────────────────   │
│  Retell API: 0 errors  │  SMS: 1 error  │  CRM: 2 errors       │
│  Calendar: 0 errors    │  Auth: 0 errors │  System: 0 errors    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
GET /api/logs
  Headers: Authorization: Bearer <token>
  Roles: super_admin only
  Query: ?level=error&category=sms&firm_id=uuid&search=failed&limit=50&offset=0&date_from=2026-03-15
  Response: {
    "logs": [ { id, level, category, message, details, source, created_at, firm: { name } }, ... ],
    "total": 234,
    "error_counts": {
      "retell_webhook": 0, "retell_api": 0, "tool_call": 0,
      "sms": 1, "email": 0, "crm_push": 2,
      "calendar": 0, "auth": 0, "system": 0
    }
  }
```

### File Structure Addition

```
/server
  /services
    logger.js                    — Structured logger (console + DB)
  /routes
    logs.js                      — GET /api/logs (super_admin only)

/client/src/pages/admin
  Logs.jsx                       — Logs viewer with filters, search, auto-refresh
```

### Global Error Handler

```js
// In server/index.js — catch all unhandled errors
const logger = require('./services/logger');

// Express error handler (last middleware)
app.use((err, req, res, next) => {
  logger.error('system', `Unhandled error: ${err.message}`, {
    details: { error: err.message, stack: err.stack, method: req.method, url: req.url, body: req.body },
    ip: req.ip,
    userId: req.user?.id,
    firmId: req.firm?.id,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('system', `Unhandled promise rejection: ${reason}`, {
    details: { error: String(reason), stack: reason?.stack },
  });
});
```

---

## 11. Environment Variables

```env
# Supabase (required)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...            # service role key (backend only)
SUPABASE_ANON_KEY=eyJhbGci...               # anon key (frontend)

# Retell AI (required)
RETELL_API_KEY=key_xxxx
RETELL_PUBLIC_KEY=pk_xxxx                       # for website widget embed
RETELL_LLM_ID=llm_xxxx                         # base LLM resource (prompt is set on LLM, not agent)

# Twilio (required for messaging)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx            # fallback sender number

# Email (required for email messaging)
RESEND_API_KEY=re_xxxx
FROM_EMAIL=noreply@leapingai.com

# Google Calendar (required for booking)
GOOGLE_CALENDAR_ID=xxxx@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON string

# App
PORT=3000
FRONTEND_URL=https://app.leapingai.com      # for CORS
NODE_ENV=production
LOG_LEVEL=info                              # 'error' | 'warn' | 'info' | 'debug'
```

Frontend `.env`:
```env
VITE_API_URL=https://api.leapingai.com      # or http://localhost:3000 in dev
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 12. Development Sequence

Exact order of implementation. Each step builds on the previous.

### Phase 1: Foundation (do these first, in order)

```
Step 1.1: Security fixes
  - Add .env and *.json credentials to .gitignore
  - Remove tracked .env from git: git rm --cached .env
  - Remove lawvoice-ai-31e65c84ca58.json from repo

Step 1.2: Database migration
  - Create 003_multi_tenant_schema.sql (Section 3 above)
  - Run in Supabase SQL Editor
  - Verify all tables, indexes, RLS policies created

Step 1.3: Auth middleware
  - Create server/middleware/auth.js (verify JWT)
  - Create server/middleware/requireRole.js
  - Create server/middleware/validateBody.js (field allowlist)
  - Add middleware to all existing routes

Step 1.4: Auth routes + Login page
  - Create server/routes/auth.js (signup, login, me)
  - Create client/src/pages/Login.jsx
  - Create client/src/context/AuthContext.jsx
  - Add auth guards to App.jsx router
  - Update client/src/services/api.js to include Bearer token

Step 1.5: Multi-tenant route filtering
  - Update server/routes/leads.js: add .eq('firm_id', req.firm.id) to all queries
  - Update server/routes/appointments.js: same
  - Add field allowlists to PATCH routes
  - Remove local store fallback from all routes (Supabase required now)

Step 1.6: Logging system
  - Create server/services/logger.js
  - Create system_logs table in Supabase
  - Add global error handler in server/index.js
  - Add logger calls to webhookController.js
  - Create server/routes/logs.js (GET /api/logs, super_admin only)

Step 1.7: Retell webhook
  - Create server/services/retell.js (API client)
  - Rewrite server/controllers/webhookController.js for Retell event format
  - Rename server/routes/vapiWebhook.js → retellWebhook.js
  - Update server/index.js route paths
  - Test with Retell webhook tester

Step 1.8: Fix existing bugs
  - Dashboard.jsx: fix activity feed sort
  - Appointments.jsx: wire dateRange to filter
  - webhookController.js: add created_at to all records
```

### Phase 2: Admin Panel

```
Step 2.1: Admin routes
  - Create server/routes/firms.js (CRUD)
  - Create server/routes/templates.js (CRUD)
  - Create server/services/promptRenderer.js

Step 2.2: Admin pages
  - Create client/src/pages/admin/AdminDashboard.jsx
  - Create client/src/pages/admin/ClientList.jsx
  - Create client/src/pages/admin/ClientCreate.jsx (the big onboarding form)
  - Create client/src/pages/admin/ClientDetail.jsx
  - Create client/src/pages/admin/TemplateList.jsx
  - Create client/src/pages/admin/Logs.jsx (filterable log viewer)
  - Update Sidebar.jsx: show admin nav for super_admin role

Step 2.3: Agent deployment
  - Create server/controllers/agentController.js
  - Wire POST /api/firms to: save firm → render prompt → create Retell agent → assign phone
  - Test: create a client and verify agent appears in Retell dashboard

Step 2.4: White-label context
  - Create client/src/context/FirmContext.jsx
  - Fetch firm config + industry_config on login
  - Update all pages to use dynamic labels from context
```

### Phase 3: Messaging Hub

```
Step 3.1: Twilio service
  - Create server/services/twilio.js (send SMS, verify signature)
  - Create server/routes/twilioWebhook.js (inbound SMS)

Step 3.2: Messages API
  - Create server/routes/messages.js (GET, POST)
  - Create server/controllers/messageController.js

Step 3.3: Frontend messaging
  - Create client/src/components/MessageTimeline.jsx
  - Create client/src/components/MessageComposer.jsx
  - Create client/src/components/MessageTemplateSelector.jsx
  - Update LeadDetail.jsx: replace old call history with unified timeline

Step 3.4: Staff management
  - Create server/routes/staff.js
  - Create client/src/pages/dashboard/Staff.jsx
  - Wire staff changes to prompt re-render + Retell update

Step 3.5: Automated messages
  - Create server/services/scheduler.js (node-cron)
  - Implement: booking confirmation, 24h reminder, 1h reminder
```

### Phase 4: CRM + Intelligence

```
Step 4.1: CRM push
  - Create server/controllers/crmPushController.js
  - Implement webhook push
  - Add CRM settings to client Settings.jsx

Step 4.2: HubSpot native
  - Implement OAuth flow
  - Field mapping UI
  - Push contacts/deals

Step 4.3: Sentiment analysis
  - After end-of-call, send transcript to LLM for sentiment classification
  - Store on calls.sentiment
  - Display on LeadDetail

Step 4.4: Prompt improvements
  - Add outcome suggestions to templates
  - Add case stage detection to templates
```

---

## 13. Git Workflow & Branching

### Branch Strategy

```
main                    — production-ready code. Never commit directly.
  └── develop           — integration branch. All feature branches merge here.
       ├── feature/*    — new features (feature/auth, feature/admin-panel, etc.)
       ├── fix/*        — bug fixes (fix/activity-sort, fix/date-filter, etc.)
       ├── refactor/*   — refactoring (refactor/retell-migration, etc.)
       └── chore/*      — config, deps, tooling (chore/env-cleanup, etc.)
```

### Branch Naming

```
feature/short-description     feature/retell-webhook
fix/short-description         fix/activity-feed-sort
refactor/short-description    refactor/vapi-to-retell
chore/short-description       chore/gitignore-cleanup
```

Always branch from `develop`. Never from `main` directly.

### Commit Rules

- **NEVER include "Co-Authored-By: Claude" or any AI attribution in commits.** No AI mentions, no "generated by", no co-author tags. Every commit looks like it was written by a human developer.
- **NEVER use `--no-verify` to skip hooks.**
- **NEVER amend published commits.** Create new commits instead.
- Write clear, concise commit messages in imperative mood:
  - `Add Retell webhook controller`
  - `Fix activity feed sort order`
  - `Remove VAPI integration`
  - `Add auth middleware with JWT verification`
- First line: under 72 characters, no period at the end
- If more detail is needed, add a blank line then a body paragraph
- Reference the phase/step when relevant:

```
Add Retell webhook handler for call events

Handles call_started, call_ended, and call_analyzed events.
Creates lead + call records from completed calls.
Phase 1, Step 1.6
```

### Workflow

```
1. Create branch:    git checkout -b feature/retell-webhook develop
2. Make changes:     (code, test, iterate)
3. Stage specific files: git add server/controllers/webhookController.js server/routes/retellWebhook.js
4. Commit:           git commit -m "Add Retell webhook controller"
5. Push:             git push -u origin feature/retell-webhook
6. PR:               Create PR → develop (not main)
7. After review:     Merge into develop
8. Release:          develop → main (when phase is complete and tested)
```

### What Goes on Each Branch

| Branch | When to create | Merge into |
|--------|---------------|------------|
| `feature/auth` | Starting Step 1.3 (auth middleware) | `develop` |
| `feature/retell-webhook` | Starting Step 1.6 (Retell migration) | `develop` |
| `fix/dashboard-bugs` | Starting Step 1.7 (bug fixes) | `develop` |
| `feature/admin-panel` | Starting Phase 2 | `develop` |
| `feature/messaging-hub` | Starting Phase 3 | `develop` |
| `feature/crm-integration` | Starting Phase 4 | `develop` |

### Tags

Tag releases on `main` when a phase is complete:

```
v0.1.0 — Phase 1 complete (foundation + Retell)
v0.2.0 — Phase 2 complete (admin panel)
v0.3.0 — Phase 3 complete (messaging hub)
v0.4.0 — Phase 4 complete (CRM + intelligence)
v1.0.0 — First production release
```

### PR Rules

- PR title matches branch purpose: "Add Retell webhook handler"
- Description includes: what changed, why, which phase/step
- Never merge directly to `main` — always go through `develop`
- Squash merge feature branches into `develop` for clean history

---

## 14. Conventions & Rules

- **No local store fallback.** Supabase is required. Remove all `localStore` code.
- **Every query filters by `firm_id`** — except super_admin routes.
- **Every PATCH uses field allowlists** — never `Object.assign(record, req.body)`.
- **Every new table has `firm_id` + RLS policy.**
- **Prompt re-render** happens automatically when staff or firm config changes.
- **Retell agent update** happens automatically after prompt re-render.
- **Messages table** is the single source for all communication (SMS, email, notes). Don't use `call_notes` JSONB on leads for new features.
- **Frontend reads `industry_config`** for all labels — never hardcode "Attorney", "Case Type", etc.
- **Webhook endpoints** validate signatures (Retell / Twilio) — no JWT auth.
- **File naming**: pages in PascalCase (`LeadDetail.jsx`), services in camelCase (`leadScoring.js`).
- **No AI attribution.** Never add "Co-Authored-By: Claude", "Generated by AI", or similar to commits, code comments, or PR descriptions.
- **Keep the Manual in sync.** After any code change, check `client/src/pages/admin/Manual.jsx`. If the change affects how something works (new route, new trigger chain, changed middleware, new env var, new DB table, changed scoring logic, etc.), update the relevant section in the Manual before committing. The Manual is the single source of truth for how the system works — it must always reflect reality.
