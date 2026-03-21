# LawVoice AI — MVP Project Plan

## Product
AI-powered voice agent + CRM for US family law firms.
Voice AI handles 24/7 intake calls, qualifies leads, books consultations.
Custom dashboard lets lawyers see leads, scores, case data, and bookings.

## Tech Stack
| Layer | Tech |
|-------|------|
| Voice AI | VAPI (API mode, GPT 4.1, ElevenLabs Sarah voice) |
| Backend | Node.js + Express (port 3000) |
| Database | Supabase (Postgres) |
| Frontend | React.js (Vite) + Tailwind CSS (port 5173) |
| SMS | Twilio |
| Calendar | Google Calendar API |
| Auth | Supabase Auth |
| Hosting | Vercel (frontend) + Render (backend) |

## Architecture
```
Phone Call → VAPI Voice Agent (Sarah) → Webhook → Express API → Supabase DB
                                                                    ↓
                                                    React Dashboard (lawyer sees leads)
```

## VAPI Assistant — Sarah
- Name: Sarah
- Firm: Mitchell Family Law
- ID: 3b2cd092-b85c-4b72-8d4d-59924bd762a1
- Voice: ElevenLabs Sarah (mature, reassuring, confident)
- Model: GPT 4.1 (OpenAI), temp 0.2, max tokens 500
- Tools: check_availability, book_appointment, endCall, transferCall
- Status: PUBLISHED

## Folder Structure
```
/server                              — Express backend
  index.js                           — App entry point
  /routes
    vapiWebhook.js                   — POST /api/vapi/webhook
    leads.js                         — GET/PATCH /api/leads
    appointments.js                  — GET/PATCH /api/appointments
  /controllers
    webhookController.js             — VAPI event handler + tool calls
  /services
    supabase.js                      — DB connection
    leadScoring.js                   — Score 0-100 algorithm
/client                              — React frontend (Vite)
  /src
    /components
      Sidebar.jsx                    — Navigation sidebar
      ScoreBadge.jsx                 — Lead score indicator
      StatusBadge.jsx                — Status pill
      StatsCard.jsx                  — Dashboard stat card
    /pages
      Dashboard.jsx                  — Overview with stats + recent leads
      Leads.jsx                      — Leads table with filters
      LeadDetail.jsx                 — Single lead: info, transcript, audio
      Appointments.jsx               — Appointments table with actions
      Settings.jsx                   — Firm info and AI config (read-only)
    /services
      api.js                         — API client for backend
/supabase
  /migrations
    001_initial_schema.sql           — All database tables
```

## Database Tables (Supabase)
- firms (id, name, email, phone, address, plan, created_at)
- users (id, firm_id, email, name, role, created_at)
- leads (id, firm_id, caller_name, caller_phone, caller_email, case_type, urgency, score, score_label, status, notes, appointment_booked, created_at)
- calls (id, lead_id, firm_id, vapi_call_id, transcript, summary, recording_url, duration, ended_reason, created_at)
- appointments (id, lead_id, firm_id, caller_name, caller_phone, caller_email, case_type, appointment_date, appointment_time, urgency, notes, status, created_at)
- intake_answers (id, call_id, lead_id, question, answer, created_at)

## MVP Features (Phase 1) — Status
- [x] VAPI voice agent with family law intake prompt
- [x] Webhook endpoint to receive call data
- [x] Tool calls: check_availability, book_appointment
- [x] Lead scoring algorithm (0-100)
- [x] React dashboard: Dashboard, Leads, Lead Detail, Appointments, Settings
- [x] Database SQL migration ready
- [ ] Supabase tables created
- [ ] Deploy to Render + Vercel
- [ ] Connect VAPI Server URLs
- [ ] Buy VAPI phone number
- [ ] Google Calendar real integration
- [ ] Twilio SMS confirmation
- [ ] Supabase Auth login

## Phase 2 (Post-MVP)
- WhatsApp/chat intake
- Sentiment analysis
- Document upload
- Automated follow-up sequences
- Analytics dashboard
- Billing/subscription management
- Multi-tenant (multiple law firms)

## Costs (MVP/Demo)
- VAPI: $10 free credit (~50 calls), then ~$0.14/min
- Supabase: Free tier (500MB)
- Vercel: Free hobby plan
- Render: Free tier
- Twilio: $15 trial credit
- Domain: ~$10/year
- Total to demo-ready: ~$12-25
