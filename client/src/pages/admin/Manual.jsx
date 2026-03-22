import { useState } from 'react';
import {
  BookOpen, ChevronRight, ChevronDown, Search, Phone, Users, Bot,
  BarChart3, Calendar, Settings, Building2, FileText, Activity,
  Zap, Shield, MessageSquare, Brain, RefreshCw, Rocket, Globe,
  AlertCircle, CheckCircle, ArrowRight, Layers, Key, Webhook,
  Clock, Star, Info,
} from 'lucide-react';

// ── Section data ────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'overview',
    icon: Layers,
    color: 'violet',
    title: 'Platform Overview',
    subtitle: 'What VoibixAI is and how it works end to end',
    content: [
      {
        heading: 'What is VoibixAI?',
        body: `VoibixAI is a white-label AI voice CRM platform. You (the super admin) onboard businesses as clients — law firms, dental clinics, plumbers, real estate agents, etc. Each client gets their own AI voice agent that answers their phone, talks to callers, collects lead information, and books appointments — all automatically, 24/7.`,
      },
      {
        heading: 'The Three Roles',
        body: null,
        table: {
          headers: ['Role', 'Who', 'What they can do'],
          rows: [
            ['Super Admin', 'You (platform owner)', 'Everything — create clients, manage agents, view all data, access logs'],
            ['Admin', 'Client owner (e.g. the lawyer)', 'Their own dashboard, leads, staff, settings — cannot see other clients'],
            ['Staff', 'Client\'s team (e.g. paralegal)', 'View leads and appointments — cannot edit settings or manage staff'],
          ],
        },
      },
      {
        heading: 'End-to-End Call Flow',
        body: null,
        steps: [
          'Someone calls the client\'s AI phone number (or uses the website widget)',
          'The Retell AI agent answers — introduces itself, asks questions, collects caller info',
          'During the call, the agent checks calendar availability and books an appointment',
          'Call ends → Retell sends a webhook to your server',
          'Your server creates a Lead and Call record in the database',
          'The client sees the new lead appear in their dashboard instantly',
          'If the client has a CRM webhook configured, the lead is also pushed there',
        ],
      },
      {
        heading: 'Tech Stack',
        body: null,
        table: {
          headers: ['Layer', 'Technology', 'Purpose'],
          rows: [
            ['Voice AI', 'Retell AI', 'AI voice agent — handles calls, understands speech, books appointments'],
            ['Backend', 'Express.js (Node)', 'API server — business logic, webhooks, database queries'],
            ['Database', 'Supabase (Postgres)', 'All data — leads, appointments, staff, firms, logs'],
            ['Frontend', 'React + Vite + Tailwind', 'Admin panel + client dashboard'],
            ['Auth', 'Supabase Auth', 'JWT-based login, 3 roles'],
            ['Calendar', 'Google Calendar API', 'Check availability, create events'],
            ['SMS', 'Twilio', 'Send/receive SMS messages'],
            ['Email', 'Resend', 'Send booking confirmations, follow-ups'],
          ],
        },
      },
    ],
  },
  {
    id: 'clients',
    icon: Building2,
    color: 'blue',
    title: 'Managing Clients',
    subtitle: 'How to create, configure, and manage client accounts',
    content: [
      {
        heading: 'Creating a New Client',
        body: 'Go to Admin → Clients → New Client. Fill in the form:',
        steps: [
          'Company name and industry (legal, dental, plumbing, real_estate, medical, other)',
          'Contact info — email, phone, address, website, business hours',
          'AI Agent — agent name (e.g. "Sarah"), voice ID from Retell dashboard, prompt template',
          'Brand color — used in the website widget',
          'Staff members — name, role, specialization (these appear in the AI prompt)',
          'Admin account — email and password for the client\'s login',
          'Deploy Agent — check this to automatically create a Retell agent and assign a phone number',
        ],
      },
      {
        heading: 'What Happens on Deploy',
        body: 'When you check "Deploy Agent" and create the client, the system automatically:',
        steps: [
          'Saves the firm to the database',
          'Creates staff records',
          'Renders the prompt template with the firm\'s real data (name, hours, staff list)',
          'Creates a Retell LLM resource with the rendered prompt + 3 tool definitions',
          'Creates a Retell Agent linked to that LLM',
          'Purchases a phone number and assigns it to the agent',
          'Registers the tool URLs (check_availability, book_appointment, save_intake_data)',
          'Creates the admin user account in Supabase Auth',
        ],
      },
      {
        heading: 'Editing a Client (ClientDetail)',
        body: 'Go to Admin → Clients → click a client. You can:',
        steps: [
          'Edit company details, business hours, contact info',
          'Change agent name, voice ID, prompt template',
          'Change brand color',
          'Change plan (free/starter/pro/enterprise) and status (active/paused/cancelled)',
          'Sync Agent — re-renders the prompt and pushes it to Retell (use after any change)',
          'Deploy Agent — if the firm was created without an agent, deploy one now',
        ],
      },
      {
        heading: 'When to Click "Sync Agent"',
        body: 'Click Sync Agent any time you change something that affects the AI\'s knowledge:',
        steps: [
          'After changing the agent name or business hours',
          'After changing the prompt template',
          'After adding or removing staff members',
          'After updating the knowledge base',
          'After deploying to production (to register the real tool URLs)',
        ],
      },
      {
        heading: 'Client Statuses',
        body: null,
        table: {
          headers: ['Status', 'Meaning'],
          rows: [
            ['Active', 'Client is live — agent is answering calls, dashboard is accessible'],
            ['Paused', 'Client is temporarily disabled — agent still exists but may not be routing calls'],
            ['Cancelled', 'Client has churned — kept for records'],
          ],
        },
      },
    ],
  },
  {
    id: 'agent',
    icon: Bot,
    color: 'purple',
    title: 'AI Agent & Retell',
    subtitle: 'How the voice agent works, prompts, tools, and phone numbers',
    content: [
      {
        heading: 'How Retell Works',
        body: 'Retell AI is the voice engine. It has two resources per client:',
        steps: [
          'LLM — contains the general_prompt (the AI\'s instructions) and the tool definitions',
          'Agent — the actual voice agent, references the LLM, has a voice ID and webhook URL',
        ],
      },
      {
        heading: 'The Three Tools',
        body: 'During a call, the AI can call three tools on your server:',
        table: {
          headers: ['Tool', 'When Used', 'What it does'],
          rows: [
            ['check_availability', 'When caller asks about scheduling', 'Checks calendar for open slots on a given date, returns list of times'],
            ['book_appointment', 'When caller agrees to a time', 'Creates appointment record, adds to Google Calendar, matches attorney by case type'],
            ['save_intake_data', 'At end of call', 'Saves structured Q&A answers (divorce papers filed? children? etc.)'],
          ],
        },
      },
      {
        heading: 'Prompt Templates',
        body: 'Templates are reusable AI prompts with {{variables}} that get replaced with real firm data. Available variables:',
        table: {
          headers: ['Variable', 'Replaced With'],
          rows: [
            ['{{agent_name}}', 'The AI agent\'s name (e.g. "Sarah")'],
            ['{{company_name}}', 'The firm\'s name (e.g. "Mitchell Family Law")'],
            ['{{business_hours}}', 'Business hours string'],
            ['{{active_staff}}', 'Bulleted list of active staff with specializations'],
            ['{{phone}}', 'Firm\'s phone number'],
            ['{{address}}', 'Firm\'s address'],
            ['{{knowledge_base}}', 'All active FAQ entries from the knowledge base'],
          ],
        },
      },
      {
        heading: 'Phone Numbers',
        body: 'Each client gets a dedicated Retell phone number when deployed. Callers dial this number → Retell routes the call to the AI agent. The number stays assigned to that client\'s agent until you change it. Phone numbers are purchased from Retell\'s pool — you can specify an area code on deploy.',
      },
      {
        heading: 'Voice IDs',
        body: 'Voice IDs come from Retell\'s voice library (powered by ElevenLabs). Find available voices in the Retell dashboard under Voices. Common format: "11labs-Adrian", "11labs-Dorothy", "retell-Cimo". Set the voice ID in the client\'s Agent Configuration field.',
      },
      {
        heading: 'Tool URL Registration',
        body: 'In development (localhost), tool URLs are NOT registered with Retell because Retell cannot reach localhost. In production, set WEBHOOK_BASE_URL to your Render URL, then go to each client → Sync Agent. This registers the 3 tool URLs so Retell knows where to call during live conversations.',
      },
    ],
  },
  {
    id: 'leads',
    icon: Users,
    color: 'emerald',
    title: 'Leads & Calls',
    subtitle: 'How leads are created from calls and how the scoring works',
    content: [
      {
        heading: 'How a Lead is Created',
        body: 'Every completed call creates a Lead record automatically:',
        steps: [
          'Call ends → Retell sends call_ended webhook to /api/retell/webhook',
          'Server looks up the firm using the agent_id from the webhook',
          'Extracts caller phone, transcript, duration, disconnection reason',
          'Calculates lead score (0–100) based on urgency, case type, appointment booked, call duration',
          'Inserts Lead record with score, status "new", case type, caller info',
          'Inserts Call record with transcript, recording URL, duration',
          'If appointment was booked during the call, links it to this lead',
          'Later, call_analyzed webhook arrives with AI summary → updates lead notes and sentiment',
        ],
      },
      {
        heading: 'Lead Scoring',
        body: null,
        table: {
          headers: ['Factor', 'Points', 'Reason'],
          rows: [
            ['Appointment booked', '+40', 'Strongest buying signal'],
            ['Urgency: high', '+20', 'Caller indicated urgency'],
            ['Urgency: medium', '+10', 'Some urgency'],
            ['Call duration > 2 min', '+15', 'Engaged caller'],
            ['Call duration > 1 min', '+8', 'Not just a hang-up'],
            ['Has email address', '+10', 'Contactable'],
            ['Has caller name', '+5', 'Identified themselves'],
          ],
        },
      },
      {
        heading: 'Score Labels',
        body: null,
        table: {
          headers: ['Label', 'Score Range', 'Meaning'],
          rows: [
            ['Hot', '70–100', 'High intent — appointment booked, follow up immediately'],
            ['Warm', '40–69', 'Interested — follow up within 24h'],
            ['Cold', '0–39', 'Low engagement — low priority'],
          ],
        },
      },
      {
        heading: 'Lead Status Flow',
        body: 'Leads move through these statuses (client updates manually or AI sets on booking):',
        steps: [
          'new — just created from call',
          'contacted — client has reached out to the caller',
          'booked — consultation scheduled',
          'converted — became a paying client',
          'closed — not interested or dead lead',
        ],
      },
      {
        heading: 'Sentiment Analysis',
        body: 'After each call, Retell\'s post-call analysis detects the caller\'s sentiment: Positive, Neutral, Negative, or Distressed. This appears on the lead detail page and helps prioritize follow-ups — a "Distressed" caller needs immediate attention.',
      },
    ],
  },
  {
    id: 'appointments',
    icon: Calendar,
    color: 'orange',
    title: 'Appointments & Calendar',
    subtitle: 'How the AI books appointments and how calendar modes work',
    content: [
      {
        heading: 'How the AI Books an Appointment',
        body: null,
        steps: [
          'Caller says they want to schedule a consultation',
          'AI calls check_availability tool with a date → server returns open time slots',
          'AI reads slots to caller: "We have 9 AM, 10:30 AM, and 2 PM available"',
          'Caller picks a time',
          'AI calls book_appointment tool with caller name, phone, email, case type, date, time',
          'Server creates an Appointment record in the database',
          'If Google Calendar is configured, creates a calendar event automatically',
          'AI confirms the booking with the caller',
        ],
      },
      {
        heading: 'Attorney Matching',
        body: 'When booking, the system tries to match the appointment to the right attorney based on case type:',
        steps: [
          'Divorce/custody/support → attorney with "Family Law" specialization',
          'If no match found → first active staff member',
          'If no staff at all → appointment is unassigned',
          'The AI confirms the assigned attorney\'s name during the call',
        ],
      },
      {
        heading: 'Calendar Modes',
        body: null,
        table: {
          headers: ['Mode', 'How it works', 'Setup needed'],
          rows: [
            ['Built-in (default)', 'Checks existing appointments in the dashboard. If Dr. Smith has an appointment at 2pm, that slot is blocked.', 'None — works immediately'],
            ['Google Calendar', 'Checks a real Google Calendar. External meetings, personal events also block slots.', 'Client connects Google account in Settings'],
          ],
        },
      },
      {
        heading: 'Appointment Statuses',
        body: null,
        table: {
          headers: ['Status', 'Meaning'],
          rows: [
            ['confirmed', 'Booked and confirmed with the caller'],
            ['completed', 'Consultation happened'],
            ['cancelled', 'Cancelled by client or caller'],
            ['no_show', 'Caller did not show up'],
          ],
        },
      },
    ],
  },
  {
    id: 'dashboard',
    icon: BarChart3,
    color: 'cyan',
    title: 'Client Dashboard',
    subtitle: 'What clients see and how to use their dashboard',
    content: [
      {
        heading: 'Dashboard Overview',
        body: 'The client dashboard shows a real-time view of their business activity. Key stats at the top: total leads, hot leads, appointments this week, conversion rate. Below that: recent leads, upcoming appointments, and activity feed.',
      },
      {
        heading: 'Leads Page',
        body: 'Shows all leads from calls. Clients can:',
        steps: [
          'Filter by status (new, contacted, booked, converted, closed)',
          'Filter by score (hot, warm, cold)',
          'Search by caller name or phone',
          'Filter by date range',
          'Click a lead to see full detail — transcript, call recording, intake answers, messages',
        ],
      },
      {
        heading: 'Lead Detail Page',
        body: 'The most detailed view in the system. Shows:',
        steps: [
          'Caller info — name, phone, email, case type, urgency, score',
          'Call recording player and full transcript',
          'AI-generated summary and sentiment',
          'Intake Q&A answers collected during the call',
          'Message timeline — SMS, email, and notes in one view',
          'Assign to attorney, set follow-up date, update status',
          'Send SMS or email directly from this page',
        ],
      },
      {
        heading: 'Knowledge Base',
        body: 'Clients can add FAQ entries that the AI learns. Go to AI Knowledge → Add Entry. Each entry has a question and answer. Active entries are injected into the AI\'s prompt via {{knowledge_base}} variable. Examples: "Do you offer free consultations?", "What are your fees?", "Where are you located?"',
      },
      {
        heading: 'Staff Management',
        body: 'Clients (admin role) can manage their staff. Go to Staff → Add Staff Member. Add name, role, and specialization. Active staff appear in the AI prompt so the agent knows who to book with. Toggling a staff member inactive removes them from the prompt automatically (triggers a Sync).',
      },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    color: 'slate',
    title: 'Settings & Integrations',
    subtitle: 'CRM webhooks, calendar, SMS, and other configuration',
    content: [
      {
        heading: 'CRM Integration (Webhook)',
        body: 'If a client wants leads pushed to their existing CRM, go to Settings → CRM Integration. Set mode to "External Webhook" or "Both". Enter their CRM\'s webhook URL. After every call, the system will POST this payload to their URL:',
        code: `{
  "event": "new_lead",
  "timestamp": "2026-03-15T22:42:00Z",
  "firm": { "id": "uuid", "name": "Mitchell Family Law" },
  "lead": {
    "id": "lead_xxx",
    "name": "John Smith",
    "phone": "+14255551234",
    "email": "john@email.com",
    "service_type": "divorce",
    "urgency": "high",
    "score": 85,
    "score_label": "hot",
    "summary": "Caller needs divorce attorney...",
    "recording_url": "https://..."
  },
  "appointment": {
    "date": "2026-03-17",
    "time": "10:00 AM",
    "status": "confirmed"
  }
}`,
      },
      {
        heading: 'Calendar Mode',
        body: 'In Settings → Appointment Calendar, clients can choose Built-in or Google Calendar mode. Built-in is recommended — zero setup. Google Calendar requires connecting a Google account which then lets the AI check real availability including external meetings.',
      },
      {
        heading: 'Agent Sync (from Settings)',
        body: 'Client admins can sync their own agent from Settings → AI Agent → Sync Agent. This re-renders their prompt and pushes it to Retell. Useful after they update their knowledge base or staff.',
      },
    ],
  },
  {
    id: 'logs',
    icon: Activity,
    color: 'red',
    title: 'System Logs',
    subtitle: 'How to monitor the platform and diagnose issues',
    content: [
      {
        heading: 'Accessing Logs',
        body: 'Go to Admin → Logs. Only super admins can see logs. You can filter by level, category, client, date range, and search by message text.',
      },
      {
        heading: 'Log Levels',
        body: null,
        table: {
          headers: ['Level', 'Color', 'When to investigate'],
          rows: [
            ['error', 'Red', 'Something failed — API call, DB error, webhook failure. Always investigate.'],
            ['warn', 'Amber', 'Something unexpected but non-fatal — slow query, missing config, fallback used'],
            ['info', 'Blue', 'Normal operations — lead created, call ended, SMS sent'],
            ['debug', 'Gray', 'Verbose detail — only in development'],
          ],
        },
      },
      {
        heading: 'Log Categories',
        body: null,
        table: {
          headers: ['Category', 'What it covers'],
          rows: [
            ['retell_webhook', 'Incoming call events from Retell (call_started, call_ended, call_analyzed)'],
            ['retell_api', 'Outgoing calls to Retell API (create agent, update LLM, deploy)'],
            ['tool_call', 'Tool calls during live calls (check_availability, book_appointment)'],
            ['calendar', 'Google Calendar API calls — slot checks, event creation'],
            ['sms', 'Twilio SMS send/receive'],
            ['email', 'Email send via Resend'],
            ['crm_push', 'Pushing lead data to external CRMs'],
            ['auth', 'Login, logout, token events'],
            ['admin', 'Super admin actions — client created, agent deployed'],
            ['database', 'Database errors'],
            ['system', 'Server start/stop, unhandled errors'],
          ],
        },
      },
      {
        heading: 'Common Issues to Look For',
        body: null,
        steps: [
          'retell_webhook errors → Retell cannot reach your server or signature invalid',
          'tool_call errors → Tool URL not registered (need to Sync Agent after deploying to prod)',
          'calendar errors → Google Calendar credentials expired or not configured',
          'crm_push errors → Client\'s webhook URL is down or returning errors',
          'sms errors → Twilio credentials not configured or invalid phone number',
          'auth errors → Token expired, user deleted, or invalid credentials',
        ],
      },
    ],
  },
  {
    id: 'deployment',
    icon: Rocket,
    color: 'indigo',
    title: 'Deployment & Hosting',
    subtitle: 'How to deploy the platform to production',
    content: [
      {
        heading: 'Architecture',
        body: null,
        table: {
          headers: ['Service', 'Platform', 'What it hosts'],
          rows: [
            ['Backend API', 'Render', 'Express.js server (server/ directory)'],
            ['Frontend', 'Vercel', 'React app (client/ directory)'],
            ['Database', 'Supabase', 'Postgres DB, Auth, Realtime'],
          ],
        },
      },
      {
        heading: 'Deploying the Backend (Render)',
        body: null,
        steps: [
          'Create a new Web Service on Render',
          'Connect GitHub repo, set Root Directory to "server"',
          'Build Command: npm install | Start Command: node index.js',
          'Add all environment variables from .env',
          'Deploy — copy the service URL (e.g. https://your-api.onrender.com)',
          'Add WEBHOOK_BASE_URL=https://your-api.onrender.com',
          'Add FRONTEND_URL=https://your-app.vercel.app',
          'Redeploy after setting those two vars',
        ],
      },
      {
        heading: 'Deploying the Frontend (Vercel)',
        body: null,
        steps: [
          'Import GitHub repo on Vercel',
          'Set Root Directory to "client"',
          'Add environment variables: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY',
          'Deploy — copy the URL and paste into Render\'s FRONTEND_URL',
        ],
      },
      {
        heading: 'After First Production Deploy',
        body: 'CRITICAL: Go to Admin → each client → Sync Agent. This registers the real production tool URLs with Retell. Without this, the AI agent cannot check availability or book appointments during calls.',
      },
      {
        heading: 'Environment Variables Reference',
        body: null,
        table: {
          headers: ['Variable', 'Required', 'Description'],
          rows: [
            ['SUPABASE_URL', 'Yes', 'Your Supabase project URL'],
            ['SUPABASE_SERVICE_KEY', 'Yes', 'Supabase service role key (backend only)'],
            ['SUPABASE_ANON_KEY', 'Yes', 'Supabase anon key (frontend)'],
            ['RETELL_API_KEY', 'Yes', 'Retell secret API key'],
            ['RETELL_PUBLIC_KEY', 'Yes', 'Retell public key (for widget embed)'],
            ['WEBHOOK_BASE_URL', 'Yes', 'Your server\'s public URL (Render URL in prod)'],
            ['FRONTEND_URL', 'Yes (prod)', 'Your frontend URL (Vercel URL) — for CORS'],
            ['TWILIO_ACCOUNT_SID', 'For SMS', 'Twilio account SID'],
            ['TWILIO_AUTH_TOKEN', 'For SMS', 'Twilio auth token'],
            ['GOOGLE_SERVICE_ACCOUNT_KEY', 'For Calendar', 'Google service account JSON as string'],
            ['LOG_LEVEL', 'No', 'info (default), debug, warn, or error'],
          ],
        },
      },
    ],
  },
  {
    id: 'devref',
    icon: FileText,
    color: 'amber',
    title: 'Developer Reference',
    subtitle: 'Architecture, trigger chains, and how the code is wired together',
    content: [
      {
        heading: 'File Map — What Each File Does',
        body: null,
        table: {
          headers: ['File', 'What it does'],
          rows: [
            ['server/index.js', 'Express entry point. Registers all middleware (CORS, rate limiters, body parser) and mounts all route files. Also starts the DB health check on boot.'],
            ['server/middleware/auth.js', 'Verifies the Supabase JWT on every request. Attaches req.user (id, role, firm_id) and req.firm (full firm record) so every route handler knows who is calling.'],
            ['server/middleware/requireRole.js', 'Called after auth.js. Checks req.user.role against an allowed list. Returns 403 if not permitted.'],
            ['server/middleware/validateBody.js', 'Strips fields from req.body that are not in the allowlist. Prevents clients from writing arbitrary DB columns via PATCH.'],
            ['server/middleware/requestId.js', 'Attaches a unique X-Request-ID to every request for log tracing.'],
            ['server/routes/retellWebhook.js', 'Receives POST /api/retell/webhook. Verifies Retell signature, routes to webhookController based on event type. Also handles tool call routes (/tool/check-availability, /tool/book-appointment, /tool/save-intake-data).'],
            ['server/controllers/webhookController.js', 'The core business logic for call processing. handleCallEnded() creates the lead + call records. handleCallAnalyzed() updates sentiment and notes. handleToolCall() dispatches to the right tool.'],
            ['server/controllers/crmPushController.js', 'After a lead is created, checks if the firm has an external CRM configured. If yes, POSTs the lead payload to their webhook URL.'],
            ['server/services/supabase.js', 'Supabase client singleton. Used everywhere for DB reads/writes.'],
            ['server/services/retell.js', 'Retell API client. Functions: createLLM(), updateLLM(), createAgent(), updateAgent(), createPhoneNumber(), syncAgent(). All outbound calls to api.retellai.com go through here.'],
            ['server/services/promptRenderer.js', 'Takes a template + firm data + active staff → returns a rendered prompt string with all {{variables}} replaced.'],
            ['server/services/googleCalendar.js', 'Interfaces with Google Calendar API. getAvailableSlots() checks a date for free 30-min slots. createAppointmentEvent() books the calendar event.'],
            ['server/services/leadScoring.js', 'Pure function: takes call data → returns { score: 0-100, label: hot/warm/cold }.'],
            ['server/services/email.js', 'Sends emails via Resend. Used for booking confirmations and follow-up reminders.'],
            ['server/services/scheduler.js', 'node-cron jobs. Runs daily to check for upcoming appointments and send reminder SMS/emails.'],
            ['server/services/logger.js', 'Structured logger. Writes to console + system_logs table in Supabase. All services and controllers use this.'],
            ['client/src/services/api.js', 'Frontend fetch wrapper. Reads the JWT from localStorage, attaches Authorization header, handles 401 redirects and caching.'],
            ['client/src/context/AuthContext.jsx', 'Holds the logged-in user and firm. Wraps the whole app. Provides useAuth() hook.'],
            ['client/src/context/FirmContext.jsx', 'Holds the firm config and industry_config (labels, case types). Provides useFirm() hook.'],
          ],
        },
      },
      {
        heading: 'Trigger Chain: Inbound Call → Lead Created',
        body: 'This is the most important flow in the system. Every lead comes from this chain:',
        steps: [
          'Caller dials the Retell phone number',
          'Retell answers, runs the AI agent (using the LLM prompt for that firm)',
          'During the call, AI calls check_availability → POST /api/retell/tool/check-availability → googleCalendar.getAvailableSlots() → returns time slots to AI',
          'AI calls book_appointment → POST /api/retell/tool/book-appointment → inserts row into appointments table → googleCalendar.createAppointmentEvent()',
          'Call ends → Retell POSTs call_ended event to POST /api/retell/webhook',
          'retellWebhook.js verifies x-retell-signature using RETELL_API_KEY',
          'Routes to webhookController.handleCallEnded()',
          'Looks up firm: SELECT * FROM firms WHERE retell_agent_id = call.agent_id',
          'leadScoring.score(call) → calculates score 0-100',
          'INSERT into leads table (firm_id, caller_phone, case_type, score, status="new")',
          'INSERT into calls table (lead_id, transcript, duration, recording_url)',
          'If appointment was booked: UPDATE appointments SET lead_id = new lead id',
          'crmPushController.maybePush(firm, lead) → if firm has CRM webhook, POSTs payload',
          '~30 seconds later: Retell POSTs call_analyzed event with AI summary + sentiment',
          'webhookController.handleCallAnalyzed() → UPDATE leads SET notes, sentiment',
        ],
      },
      {
        heading: 'Trigger Chain: Staff Changed → Agent Updated',
        body: 'When a staff member is added, removed, or toggled active/inactive:',
        steps: [
          'Client clicks toggle on Staff page → PATCH /api/staff/:id { is_active: false }',
          'server/routes/staff.js updates the staff record in Supabase',
          'After the DB update, route handler calls promptRenderer.renderPrompt(template, firm, activeStaff)',
          'renderPrompt() fetches all is_active=true staff for the firm, builds {{active_staff}} list',
          'Rendered prompt string is saved to firms.rendered_prompt in Supabase',
          'retell.updateLLM(firm.retell_llm_id, { general_prompt: renderedPrompt }) → PATCH to api.retellai.com',
          'Retell now has the updated staff list — next call will use the new prompt immediately',
        ],
      },
      {
        heading: 'Trigger Chain: New Client Created → Agent Deployed',
        body: 'When you create a new client with Deploy Agent checked:',
        steps: [
          'POST /api/firms with firm data + staff array + admin_email',
          'server/routes/firms.js saves firm record to Supabase',
          'Saves all staff records with firm_id',
          'Fetches the selected prompt template',
          'promptRenderer.renderPrompt(template, firm, staff) → rendered prompt string',
          'retell.createLLM({ general_prompt: renderedPrompt, tools: [3 tool definitions] }) → creates Retell LLM resource, returns llm_id',
          'retell.createAgent({ llm_id, voice_id, agent_name, webhook_url }) → creates Retell Agent, returns agent_id',
          'retell.createPhoneNumber({ area_code, agent_id }) → purchases number, returns phone_number',
          'UPDATE firms SET retell_agent_id, retell_llm_id, retell_phone_number',
          'supabase.auth.admin.createUser({ email, password }) → creates the client admin login',
          'Response returned with full firm record including phone number',
        ],
      },
      {
        heading: 'Trigger Chain: Frontend API Request',
        body: 'How every frontend API call flows through the system:',
        steps: [
          'React component calls e.g. fetchLeads() from client/src/services/api.js',
          'api.js checks cache — if GET and cache hit, returns immediately (no network call)',
          'api.js reads JWT from localStorage (sb-{hostname}-auth-token)',
          'api.js checks token expiry — if expired, returns null (Supabase will auto-refresh)',
          'fetch() with Authorization: Bearer {token} header',
          'server/middleware/requestId.js attaches unique X-Request-ID',
          'server/middleware/auth.js verifies JWT with Supabase, attaches req.user + req.firm',
          'server/middleware/requireRole.js checks role if route requires it',
          'Route handler runs (e.g. leads.js GET) — queries Supabase filtered by req.firm.id',
          'Response returned, api.js caches it (GET) or invalidates related cache (mutations)',
        ],
      },
      {
        heading: 'Database Relationships',
        body: null,
        table: {
          headers: ['Table', 'Links to', 'Via column'],
          rows: [
            ['users', 'firms', 'users.firm_id → firms.id'],
            ['staff', 'firms', 'staff.firm_id → firms.id'],
            ['leads', 'firms', 'leads.firm_id → firms.id'],
            ['leads', 'staff', 'leads.assigned_staff_id → staff.id'],
            ['calls', 'leads', 'calls.lead_id → leads.id'],
            ['calls', 'firms', 'calls.firm_id → firms.id'],
            ['appointments', 'leads', 'appointments.lead_id → leads.id'],
            ['appointments', 'firms', 'appointments.firm_id → firms.id'],
            ['appointments', 'staff', 'appointments.assigned_staff_id → staff.id'],
            ['messages', 'leads', 'messages.lead_id → leads.id'],
            ['messages', 'firms', 'messages.firm_id → firms.id'],
            ['intake_answers', 'calls', 'intake_answers.call_id → calls.id'],
            ['intake_answers', 'leads', 'intake_answers.lead_id → leads.id'],
            ['firms', 'prompt_templates', 'firms.prompt_template_id → prompt_templates.id'],
            ['system_logs', 'firms', 'system_logs.firm_id → firms.id (nullable)'],
          ],
        },
      },
      {
        heading: 'Middleware Execution Order',
        body: 'Every API request passes through these layers in order before hitting the route handler:',
        steps: [
          'requestId.js — generates X-Request-ID, attaches to req and res headers',
          'cors() — checks Origin header against allowedOrigins list, rejects if not matched',
          'Security headers middleware — sets X-Frame-Options, CSP, HSTS etc.',
          'express.json({ limit: "1mb" }) — parses request body, rejects oversized payloads',
          'Rate limiter (route-specific) — loginLimiter, webhookLimiter, or generalApiLimiter',
          'requestLogger — logs method + URL + status + duration to system_logs',
          'auth.js — verifies JWT, attaches req.user and req.firm (skipped for webhook routes)',
          'requireRole(...) — checks req.user.role matches allowed roles (if applied to route)',
          'validateBody(allowlist) — strips non-allowlisted fields from req.body (if applied)',
          'Route handler — actual business logic runs here',
          'Global error handler — catches any thrown errors, logs to system_logs, returns 500',
        ],
      },
      {
        heading: 'Key Environment Variables and Where They Are Used',
        body: null,
        table: {
          headers: ['Variable', 'Used in', 'What breaks without it'],
          rows: [
            ['SUPABASE_URL + SUPABASE_SERVICE_KEY', 'server/services/supabase.js', 'Server refuses to start — all DB ops fail'],
            ['RETELL_API_KEY', 'server/services/retell.js + webhook signature verify', 'Cannot create/update agents, all webhooks rejected'],
            ['WEBHOOK_BASE_URL', 'server/routes/firms.js (tool URL registration)', 'Tools not registered — AI cannot book appointments or check calendar during calls'],
            ['FRONTEND_URL', 'server/index.js (CORS)', 'In production, all frontend requests rejected with CORS error'],
            ['TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN', 'server/services/twilio.js', 'SMS send fails, inbound SMS not verified'],
            ['GOOGLE_SERVICE_ACCOUNT_KEY', 'server/services/googleCalendar.js', 'Falls back to mock slots — real calendar not checked'],
            ['RESEND_API_KEY', 'server/services/email.js', 'Booking confirmation emails not sent'],
          ],
        },
      },
      {
        heading: 'How the Cache Works (Frontend)',
        body: 'client/src/services/cache.js implements a simple in-memory cache for GET requests:',
        steps: [
          'Every GET request is cached after first fetch with a TTL (time-to-live) per route',
          'Leads: 30s TTL | Appointments: 60s TTL | Staff: 5 min TTL | Firms: 5 min TTL',
          'Any mutation (POST/PATCH/DELETE) to a path invalidates all cached GET entries for related paths',
          'Example: PATCH /leads/123 → invalidates /leads and /leads/123 from cache',
          'This means the UI shows fresh data after any change without manual refresh',
          'Cache is in-memory only — cleared on page reload or tab close',
        ],
      },
      {
        heading: 'Adding a New Feature — Checklist',
        body: 'When a developer adds a new feature, here is what typically needs to change:',
        steps: [
          'Database: add table/column in a new Supabase migration SQL file',
          'RLS: add Row Level Security policies for the new table (firm isolation + super_admin)',
          'Backend route: create or update a file in server/routes/',
          'Auth: add authenticate + requireRole middleware to the new route',
          'Validation: add validateBody(allowlist) if it is a PATCH route',
          'Logging: add logger.info/error calls at key points in the controller',
          'Frontend API: add a function to client/src/services/api.js',
          'Frontend page/component: build the UI, import the API function',
          'Route: register the new page in client/src/App.jsx',
          'Nav: add nav link in client/src/components/Navbar.jsx if it needs a menu item',
          'Manual: add a section here so future developers understand the feature',
        ],
      },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    color: 'rose',
    title: 'Security',
    subtitle: 'How the platform is secured and what to know',
    content: [
      {
        heading: 'Authentication',
        body: 'All API routes (except webhooks and /api/public/config) require a valid Supabase JWT token in the Authorization header. Tokens expire automatically. If a token expires while the user is logged in, they are redirected to the login page.',
      },
      {
        heading: 'Multi-Tenant Isolation',
        body: 'Every database query on client-facing routes filters by firm_id. A client admin cannot see another client\'s leads, appointments, or staff — even if they manually change the URL. This is enforced both at the API level and by Supabase Row Level Security (RLS) policies.',
      },
      {
        heading: 'Webhook Security',
        body: 'Retell webhooks are verified using the x-retell-signature header. The server verifies the signature using the RETELL_API_KEY before processing any webhook event. Invalid signatures are rejected immediately.',
      },
      {
        heading: 'Rate Limiting',
        body: null,
        table: {
          headers: ['Endpoint', 'Limit'],
          rows: [
            ['POST /api/auth/login', '5 attempts per 15 minutes'],
            ['POST /api/auth/signup', '3 attempts per hour'],
            ['Webhook endpoints', '1000 requests per minute'],
            ['All other API routes', '100 requests per minute'],
          ],
        },
      },
      {
        heading: 'Field Allowlists',
        body: 'PATCH endpoints only accept specific fields. Clients cannot inject arbitrary fields into the database. For example, PATCH /api/leads only accepts: status, assigned_staff_id, follow_up_date, notes. Any other field is stripped before the database update.',
      },
    ],
  },
];

const COLOR_MAP = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', active: 'bg-violet-600 text-white' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',   active: 'bg-blue-600 text-white' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', active: 'bg-purple-600 text-white' },
  emerald:{ bg: 'bg-emerald-50',text: 'text-emerald-600',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700',active: 'bg-emerald-600 text-white' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', active: 'bg-orange-600 text-white' },
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-700',   active: 'bg-cyan-600 text-white' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-700', active: 'bg-slate-700 text-white' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    active: 'bg-red-600 text-white' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700',active: 'bg-indigo-600 text-white' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-200',   badge: 'bg-rose-100 text-rose-700',  active: 'bg-rose-600 text-white' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700', active: 'bg-amber-600 text-white' },
};

export default function Manual() {
  const [activeSection, setActiveSection] = useState('overview');
  const [search, setSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (key) => setExpandedItems(p => ({ ...p, [key]: !p[key] }));

  const filteredSections = search.trim()
    ? SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(search.toLowerCase()) ||
        s.content.some(c =>
          c.heading.toLowerCase().includes(search.toLowerCase()) ||
          (c.body && c.body.toLowerCase().includes(search.toLowerCase())) ||
          (c.steps && c.steps.some(st => st.toLowerCase().includes(search.toLowerCase())))
        )
      )
    : SECTIONS;

  const currentSection = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
            <BookOpen size={18} className="text-violet-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Platform Manual</h1>
        </div>
        <p className="text-sm text-slate-400 ml-12">Complete guide to VoibixAI — how everything works end to end</p>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar — Navigation */}
        <div className="w-64 shrink-0 space-y-2">
          {/* Search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search manual..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300"
            />
          </div>

          {/* Nav items */}
          {SECTIONS.map(section => {
            const colors = COLOR_MAP[section.color];
            const isActive = activeSection === section.id && !search;
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => { setActiveSection(section.id); setSearch(''); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isActive
                    ? `${colors.active} shadow-sm`
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} className={isActive ? 'opacity-90' : colors.text} />
                <span className="text-sm font-medium">{section.title}</span>
              </button>
            );
          })}
        </div>

        {/* Right — Content */}
        <div className="flex-1 min-w-0">
          {search ? (
            /* Search results */
            <div className="space-y-4">
              <p className="text-sm text-slate-500">{filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''} match "{search}"</p>
              {filteredSections.map(section => (
                <SectionCard key={section.id} section={section} highlight={search} expandedItems={expandedItems} toggleItem={toggleItem} />
              ))}
              {filteredSections.length === 0 && (
                <div className="text-center py-16">
                  <Search size={32} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No results for "{search}"</p>
                </div>
              )}
            </div>
          ) : (
            /* Single section view */
            currentSection && (
              <SectionCard section={currentSection} expandedItems={expandedItems} toggleItem={toggleItem} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section, highlight, expandedItems, toggleItem }) {
  const colors = COLOR_MAP[section.color];
  const Icon = section.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Section header */}
      <div className={`px-6 py-5 ${colors.bg} border-b ${colors.border}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm`}>
            <Icon size={20} className={colors.text} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
            <p className="text-sm text-slate-500">{section.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Content blocks */}
      <div className="divide-y divide-slate-50">
        {section.content.map((block, idx) => {
          const key = `${section.id}-${idx}`;
          const isExpanded = expandedItems[key] !== false; // default open

          return (
            <div key={idx} className="px-6 py-5">
              <button
                onClick={() => toggleItem(key)}
                className="w-full flex items-center justify-between gap-3 text-left group mb-0"
              >
                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-violet-600 transition-colors">
                  {block.heading}
                </h3>
                {isExpanded
                  ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                  : <ChevronRight size={15} className="text-slate-400 shrink-0" />
                }
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-3">
                  {block.body && (
                    <p className="text-sm text-slate-600 leading-relaxed">{block.body}</p>
                  )}

                  {block.steps && (
                    <ol className="space-y-2">
                      {block.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className={`shrink-0 w-5 h-5 rounded-full ${colors.badge} text-[11px] font-bold flex items-center justify-center mt-0.5`}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-slate-600 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {block.table && (
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            {block.table.headers.map((h, i) => (
                              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {block.table.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              {row.map((cell, j) => (
                                <td key={j} className={`px-4 py-3 text-slate-600 ${j === 0 ? 'font-medium text-slate-800' : ''}`}>
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {block.code && (
                    <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto leading-relaxed font-mono">
                      {block.code}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
