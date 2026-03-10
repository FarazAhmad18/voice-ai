# LawVoice AI — MVP Project Plan

## Product
AI-powered voice agent + CRM for US family law firms.
Voice AI handles 24/7 intake calls, qualifies leads, books consultations.
Custom dashboard lets lawyers see leads, scores, case data, and bookings.

## Tech Stack
| Layer | Tech |
|-------|------|
| Voice AI | VAPI (API mode) |
| Backend | Node.js + Express |
| Database | Supabase (Postgres) |
| Frontend | React.js + Tailwind CSS |
| SMS | Twilio |
| Calendar | Google Calendar API |
| Auth | Supabase Auth |
| Hosting | Vercel (frontend) + Render (backend) |

## Architecture
```
Phone Call → VAPI Voice Agent → Webhook → Express API → Supabase DB
                                                          ↓
                                              React Dashboard (lawyer sees leads)
```

## MVP Features (Phase 1)
1. VAPI voice agent with family law intake prompt
2. Webhook endpoint to receive call data
3. Supabase DB with leads, calls, firms tables
4. React dashboard: lead list, lead detail, call transcripts
5. Lead scoring (auto-calculated from intake answers)
6. Google Calendar booking integration
7. SMS confirmation via Twilio
8. Multi-tenant auth (each firm sees only their data)

## Phase 2 (Post-MVP)
- WhatsApp/chat intake
- Sentiment analysis
- Document upload
- Automated follow-up sequences
- Analytics dashboard
- Billing/subscription management

## Folder Structure
```
/server          — Express backend
  /routes        — API routes
  /controllers   — Business logic
  /middleware     — Auth, validation
  /services      — VAPI, Twilio, Calendar integrations
  /config        — DB, env config
/client          — React frontend
  /src
    /components  — UI components
    /pages       — Dashboard pages
    /hooks       — Custom hooks
    /services    — API calls
    /context     — Auth, app state
/shared          — Shared types/constants
```

## VAPI Setup Checklist
- [ ] Create assistant with family law system prompt
- [ ] Configure phone number
- [ ] Set webhook URL (server-url/api/vapi/webhook)
- [ ] Define tool calls (book_appointment, transfer_call, etc.)
- [ ] Test with sample calls

## Database Tables (Supabase)
- firms (id, name, email, phone, plan, created_at)
- users (id, firm_id, name, email, role, created_at)
- leads (id, firm_id, name, phone, email, case_type, score, status, created_at)
- calls (id, lead_id, firm_id, vapi_call_id, transcript, summary, duration, recording_url, created_at)
- appointments (id, lead_id, firm_id, datetime, status, calendar_event_id, created_at)
- intake_answers (id, call_id, lead_id, question, answer, created_at)

## Costs (MVP/Demo)
- VAPI: $10 free credit (~50 calls), then ~$0.05-0.15/min
- Supabase: Free tier (500MB)
- Vercel: Free hobby plan
- Render: Free tier
- Twilio: $15 trial credit
- Domain: ~$10/year
- Total to demo-ready: ~$12-25
