# VoibixAI — Business Logic Reference

> This file documents the core business decisions and rules that drive how the platform works.
> It answers **why** things work the way they do — not how the code is written.
> Update this file whenever a major business decision changes.

---

## 1. Multi-Tenant Architecture

- Every firm is completely isolated. A firm can only see its own leads, appointments, staff, and messages.
- Super admin can see everything across all firms.
- `firm_id` is attached to every record in every table. Every query filters by it.
- A user belongs to exactly one firm (except super_admin whose `firm_id` is null).

---

## 2. AI Agent — Prompt Injection (Approach A)

**Decision:** Staff names and knowledge base answers are injected directly into the AI prompt — not fetched via mid-call tool functions.

**Why:**
- Zero latency — AI knows staff/knowledge from call start, no round-trip needed
- Simpler — no extra tool functions to maintain
- Reliable — no risk of tool timeout mid-call

**How it works:**
```
Staff added/edited/removed
→ reRenderFirmPrompt() runs
→ Fetches active staff + knowledge from DB
→ Replaces {{active_staff}} and {{knowledge_base}} in template
→ Saves rendered_prompt to firms table
→ Pushes to Retell LLM via SDK
→ Next call uses updated prompt instantly
```

**When to re-render:**
- Staff added, edited, removed, toggled active/inactive
- Knowledge base entry added, edited, removed
- Firm name, business hours, agent name changed
- Prompt template changed or re-linked

---

## 3. Attorney Assignment on Appointments

When `book_appointment` is called by the AI, the attorney is resolved in this priority order:

```
1. staff_name passed by AI (exact/fuzzy name match)
   → "Attorney James Harlow" → finds James Harlow in staff table

2. case_type match against staff specializations
   → case_type: "divorce" → finds attorney with "Family Law / Divorce" specialization

3. First active staff member (last resort — always assigns someone)
```

**Why always assign someone:** An appointment with no attorney assigned is useless for the firm. Better to assign the first available than leave it blank.

**Case type → specialization keyword map:**
| Case Type | Matches specialization containing |
|-----------|----------------------------------|
| divorce | divorce, family, separation |
| custody | custody, child, family, parental |
| support | support, alimony, family |
| domestic_violence | domestic, violence, protective, order |
| paternity | paternity, family |
| adoption | adoption, family |

---

## 4. Calendar Mode — Availability Checking

Each firm independently chooses how availability is checked. Stored as `firms.calendar_mode`.

### Mode: `builtin` (default)
- Availability is checked directly against the `appointments` table in Supabase
- Per-attorney: checks slots for the specific assigned attorney only
- Zero setup required — works immediately when firm is onboarded
- Limitation: external meetings (court dates, personal) not in the system won't block slots

### Mode: `google`
- Availability is checked against a Google Calendar linked to the firm
- Requires: `firms.google_calendar_id` set in admin panel
- The firm's Google Calendar must be shared with the platform's service account
- Advantage: external meetings block slots automatically
- Booking also creates a Google Calendar event for the attorney

**Decision rule:**
```
check_availability called
→ fetch firm by agent_id
→ if firm.calendar_mode = 'builtin' → query appointments table (per attorney)
→ if firm.calendar_mode = 'google'  → query Google Calendar API
```

**Why this approach:**
- Small/new firms: builtin is zero-friction, works immediately
- Established firms with existing Google Calendar workflows: can switch to google mode
- Scales to any number of clients without manual setup per client
- Can be toggled per firm in the admin panel at any time

---

## 5. Lead Scoring

Leads are scored 0–100 and labeled hot/warm/cold based on:

| Signal | Points |
|--------|--------|
| Appointment booked | +40 |
| Urgency: high | +25 |
| Urgency: medium | +15 |
| Case type: domestic_violence | +20 |
| Case type: divorce/custody | +10 |
| Has email | +10 |
| Has name (not Unknown) | +5 |

**Labels:**
- 70–100 → hot
- 40–69 → warm
- 0–39 → cold

---

## 6. Duplicate Lead Prevention

- If a call comes in from the same phone number within 24 hours → update existing lead, don't create a new one
- If a caller books the same date/time/phone → return existing confirmation, don't double-book

---

## 7. CRM Push

Each firm has a `crm_mode` setting:

| Mode | Behavior |
|------|----------|
| `builtin` | Data stays in VoibixAI dashboard only |
| `external` | Push to external CRM (webhook / HubSpot / Salesforce) |
| `both` | Save in dashboard AND push to external CRM |

Push happens after:
1. New lead created (call ended)
2. Appointment booked

---

## 8. Webhook vs Auth Routes

- **Retell webhook** (`/api/retell/webhook`, `/api/retell/tool/*`) — no JWT auth, validated by Retell signature (`x-retell-signature`)
- **Twilio webhook** (`/api/twilio/sms`) — no JWT auth, validated by Twilio signature
- **All other routes** — require JWT Bearer token in Authorization header

**Why:** Webhooks come from third-party servers, not from logged-in users. They can't send JWTs. Signature validation is the equivalent security mechanism.

---

## 9. Prompt Re-render is Always Non-Blocking

Staff changes and knowledge updates trigger `reRenderAndSync()` as fire-and-forget:
```js
reRenderAndSync(firmId).catch(() => {});
res.json(data); // responds immediately
```

**Why:** Re-rendering involves DB queries + Retell API call which can take 1–3 seconds. The HTTP response returns instantly. The sync completes in the background. UI doesn't wait for it.

---

## 10. Staff Delete = Soft Delete in DB, Hard Delete in UI

- DB: `is_active = false` (record kept for historical appointment/lead references)
- UI: member removed from list immediately (`filter` not `map`)
- Prompt: re-rendered without the deleted staff member

**Why keep in DB:** Past appointments reference `assigned_staff_id`. Hard deleting would break those foreign keys and lose history.
