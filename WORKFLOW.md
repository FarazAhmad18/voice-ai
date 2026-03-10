# LawVoice AI — Complete Project Workflow

## Step 1: VAPI Platform (dashboard.vapi.ai)

### 1A. Get Your API Key
```
Dashboard → Organization Settings → API Keys → Copy it
```
You'll put this in your `.env` file in VS Code later.

### 1B. Create an Assistant
```
Dashboard → Assistants → Create New
```
You configure:

| Setting | What You Set |
|---------|-------------|
| **Name** | "Family Law Intake Agent" |
| **Model** | GPT-4o (best price/quality) or GPT-4.1 |
| **Voice** | Pick from ElevenLabs/Cartesia (listen to samples, pick professional female/male) |
| **System Prompt** | THE BIG ONE — this is your agent's brain (see below) |
| **First Message** | What AI says when it picks up: "Thank you for calling [Firm Name], I'm an AI assistant..." |
| **Tools** | Add custom tools like `book_appointment`, `check_availability` |
| **Server URL** | Your Express backend URL (e.g., `https://your-app.render.com/api/vapi/webhook`) |
| **End Call Phrases** | "goodbye", "thank you bye" etc. |
| **Max Duration** | 10-15 minutes |
| **Voicemail Detection** | Enable |

### 1C. The System Prompt (you write this on VAPI)
This tells the AI WHO it is and WHAT to do:

```
You are a friendly, professional AI legal assistant for {{firmName}}.
You help potential clients with family law matters.

YOUR JOB:
1. Greet warmly, introduce yourself
2. Ask their name and how to reach them (phone/email)
3. Ask what family law issue they need help with
4. Based on their answer, ask these intake questions:

FOR DIVORCE:
- Are divorce papers already filed?
- How long have you been married?
- Are there children involved? Ages?
- Are there shared assets or property?
- Is there urgency (safety concerns)?

FOR CHILD CUSTODY:
- Is there an existing custody order?
- What changes are you seeking?
- Are there safety concerns?
- Is there a hearing date coming up?

5. Ask about their preferred consultation time
6. Use the book_appointment tool to schedule
7. Confirm the appointment and say goodbye

RULES:
- Be empathetic, many callers are emotional
- Never give legal advice
- If someone has an emergency, say "Please call 911"
- If urgent legal matter, flag as high priority
- Keep conversation under 8 minutes
```

### 1D. Set Up Tools (on VAPI platform)
```
Assistant → Tools → Add Tool
```

**Tool 1: `book_appointment`**
```
Name: book_appointment
Description: Book a consultation appointment for the caller
Parameters:
  - caller_name (string, required)
  - caller_phone (string, required)
  - caller_email (string, optional)
  - case_type (string: divorce/custody/support/other)
  - preferred_date (string)
  - preferred_time (string)
  - urgency (string: low/medium/high)
  - notes (string — AI summary of the case)
Server URL: https://your-app.render.com/api/vapi/tool/book-appointment
```

**Tool 2: `check_availability`**
```
Name: check_availability
Description: Check available appointment slots
Parameters:
  - date (string)
Server URL: https://your-app.render.com/api/vapi/tool/check-availability
```

**Tool 3: `transfer_call` (built-in)**
```
Type: transferCall
Destinations: ["+1234567890"] (lawyer's real number)
Description: Transfer to a human when caller insists or urgent
```

### 1E. Get a Phone Number
```
Dashboard → Phone Numbers → Buy Number (or import Twilio number)
→ Assign your Assistant to this number
```
Now when someone calls this number → your AI agent answers.

### 1F. Copy Assistant ID
```
Dashboard → Assistants → Click your assistant → Copy the ID
```
You'll need this in your code.

---

## Step 2: VS Code — Backend (Express)

Now you switch to VS Code and build the server that RECEIVES data from VAPI.

### 2A. What You Code:

```
/server
  index.js              ← Express app entry point
  /routes
    vapiWebhook.js      ← Receives ALL VAPI events
    leads.js            ← CRUD API for dashboard
    appointments.js     ← CRUD API for dashboard
    auth.js             ← Login/signup for law firms
  /controllers
    webhookController.js ← Processes VAPI events
    leadController.js    ← Lead business logic
    scoringService.js    ← Calculates lead score
  /services
    supabase.js         ← Database connection
    calendar.js         ← Google Calendar API
    twilio.js           ← SMS sending
```

### 2B. The Webhook — This is the BRIDGE

When VAPI sends events, your Express server handles them:

```
POST /api/vapi/webhook → receives ALL events from VAPI

Event: "tool-calls" (DURING call)
  → AI wants to book appointment
  → Your server checks Google Calendar
  → Returns available slots to AI
  → AI tells caller the options

Event: "end-of-call-report" (AFTER call)
  → You get: transcript, recording, duration, caller info
  → Your server: creates lead in Supabase
  → Calculates lead score
  → Sends SMS confirmation to caller
  → Lead appears on dashboard
```

### 2C. Tool Call Endpoints (VAPI calls these MID-conversation):

```
POST /api/vapi/tool/book-appointment
  → Receives: { caller_name, phone, case_type, date, time }
  → Your code: creates Google Calendar event
  → Your code: saves appointment to Supabase
  → Returns: { success: true, message: "Booked for Tuesday 3PM" }
  → AI tells caller: "You're all set for Tuesday at 3 PM!"

POST /api/vapi/tool/check-availability
  → Receives: { date: "2026-03-15" }
  → Your code: checks Google Calendar for open slots
  → Returns: { slots: ["10:00 AM", "2:00 PM", "4:00 PM"] }
  → AI tells caller: "I have 10 AM, 2 PM, or 4 PM available"
```

---

## Step 3: VS Code — Database (Supabase)

### 3A. Create Tables on Supabase Dashboard (supabase.com) or via SQL:

```
firms        → law firm accounts
users        → lawyers/staff
leads        → every caller's info + score
calls        → VAPI call data (transcript, recording)
appointments → booked consultations
intake_answers → structured Q&A from call
```

### 3B. Set Up Row Level Security
Each firm only sees their own data. Configure on Supabase dashboard.

---

## Step 4: VS Code — Frontend (React + Tailwind)

### 4A. What You Build:

```
/client/src
  /pages
    Login.jsx           ← Law firm login
    Dashboard.jsx       ← Overview: today's leads, upcoming appointments
    Leads.jsx           ← All leads list with scores, status
    LeadDetail.jsx      ← Single lead: info, transcript, recording player
    Appointments.jsx    ← Calendar view of bookings
    Settings.jsx        ← Firm settings, phone number, prompt config
  /components
    LeadCard.jsx        ← Lead summary card
    ScoreBadge.jsx      ← Green/yellow/red score indicator
    TranscriptViewer.jsx← Shows call transcript
    AudioPlayer.jsx     ← Play call recording
    StatsWidget.jsx     ← "12 leads today", "8 booked"
```

---

## Step 5: Deploy & Connect

| What | Where | How |
|------|-------|-----|
| Backend | Render.com (free) | Push to GitHub → auto-deploy |
| Frontend | Vercel (free) | Push to GitHub → auto-deploy |
| Database | Supabase (free) | Already hosted |
| VAPI Server URL | Update on VAPI dashboard | Point to your Render URL |

---

## The Complete Flow (everything connected):

```
1. Client calls your VAPI phone number
                    ↓
2. VAPI AI answers with your system prompt
   "Hi, thank you for calling Smith Family Law..."
                    ↓
3. AI asks intake questions (from your prompt)
   "Can you tell me what family law matter you need help with?"
                    ↓
4. Caller says "I need help with divorce"
                    ↓
5. AI asks follow-up questions
   "Are divorce papers already filed?"
   "Are there children involved?"
                    ↓
6. AI decides to book → calls YOUR server (tool call)
   POST /api/vapi/tool/check-availability
   Your server checks Google Calendar → returns slots
                    ↓
7. AI offers times → caller picks one
   POST /api/vapi/tool/book-appointment
   Your server books it → returns confirmation
                    ↓
8. Call ends → VAPI sends end-of-call-report to YOUR server
   Your server:
   ├── Saves lead to Supabase
   ├── Saves transcript + recording
   ├── Calculates lead score (high - has kids, urgent)
   ├── Sends SMS to caller: "Confirmed: Tuesday 3PM with Smith Law"
   └── Sends SMS to lawyer: "New qualified lead: John, divorce, high priority"
                    ↓
9. Lawyer opens YOUR React dashboard
   → Sees new lead with score, transcript, recording
   → Clicks play to listen
   → Sees appointment on calendar
   → Ready for consultation
```

---

## Order of Work in VS Code:

| Order | What | Why First |
|-------|------|-----------|
| **1** | `server/` setup + webhook endpoint | So VAPI has somewhere to send data |
| **2** | Supabase tables | So webhook can store data |
| **3** | Tool call endpoints (book, check) | So AI can book mid-call |
| **4** | Test with VAPI (make test calls) | Verify the connection works |
| **5** | React dashboard | Now you have real data to display |
| **6** | Auth + multi-tenant | So you can onboard multiple firms |
| **7** | SMS notifications | Polish |
| **8** | Deploy to Render + Vercel | Go live |
