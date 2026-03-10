# VAPI Tools — Exact Field-by-Field Setup Guide

Follow this for each tool. Fill EXACTLY what's listed, leave everything else as default.

---

## TOOL 1: check_availability

### Tool Settings

| Field | Value |
|-------|-------|
| **Tool Name** | `check_availability` |
| **Description** | `Check available appointment slots for a given date. Call this when the caller wants to schedule and you need to find open times.` |
| **Async** | OFF (leave unchecked) |
| **Strict** | OFF (leave unchecked) |

### Parameters
Click "Add Property" for each:

**Parameter 1:**
| Field | Value |
|-------|-------|
| Name | `date` |
| Type | `string` |
| Required | YES (checked) |
| Description | `The date to check availability for, format YYYY-MM-DD` |

**Parameter 2:**
| Field | Value |
|-------|-------|
| Name | `case_type` |
| Type | `string` |
| Required | NO (unchecked) |
| Description | `Type of case: divorce, custody, support, domestic_violence, paternity, adoption, other` |

### Server Settings

| Field | Value |
|-------|-------|
| **Server URL** | Leave blank for now (we will set after backend is deployed) |
| **Timeout** | `20` (default is fine) |

### Authorization

| Field | Value |
|-------|-------|
| Credential | No authentication (leave default) |

### HTTP Headers
Leave empty — no headers needed.

### Encryption Settings
Leave empty — not needed.

### Static Body Fields
Leave empty — not needed.

### Response Body
Leave empty — not needed for now.

### Aliases
Leave empty.

### Messages
These are what Sarah says while the tool is running. Click "Add Message" if the option is available:

| Stage | Message |
|-------|---------|
| **Request Start** (when tool is called) | `Let me check what times are available for you.` |
| **Request Complete** (when tool returns) | Leave empty (AI will naturally respond with the results) |
| **Request Failed** (if tool errors) | `I'm sorry, I'm having trouble checking our schedule right now. Can I take your information and have someone call you back?` |

---

## TOOL 2: book_appointment

### Tool Settings

| Field | Value |
|-------|-------|
| **Tool Name** | `book_appointment` |
| **Description** | `Book a consultation appointment after the caller has selected a time slot. Call this to confirm the booking.` |
| **Async** | OFF (leave unchecked) |
| **Strict** | OFF (leave unchecked) |

### Parameters
Click "Add Property" for each:

**Parameter 1:**
| Field | Value |
|-------|-------|
| Name | `caller_name` |
| Type | `string` |
| Required | YES |
| Description | `Full name of the caller` |

**Parameter 2:**
| Field | Value |
|-------|-------|
| Name | `caller_phone` |
| Type | `string` |
| Required | YES |
| Description | `Phone number of the caller` |

**Parameter 3:**
| Field | Value |
|-------|-------|
| Name | `caller_email` |
| Type | `string` |
| Required | NO |
| Description | `Email address of the caller` |

**Parameter 4:**
| Field | Value |
|-------|-------|
| Name | `case_type` |
| Type | `string` |
| Required | YES |
| Description | `Type of case: divorce, custody, support, domestic_violence, paternity, adoption, other` |

**Parameter 5:**
| Field | Value |
|-------|-------|
| Name | `appointment_date` |
| Type | `string` |
| Required | YES |
| Description | `Selected date in YYYY-MM-DD format` |

**Parameter 6:**
| Field | Value |
|-------|-------|
| Name | `appointment_time` |
| Type | `string` |
| Required | YES |
| Description | `Selected time like 10:00 AM` |

**Parameter 7:**
| Field | Value |
|-------|-------|
| Name | `urgency` |
| Type | `string` |
| Required | YES |
| Description | `Priority level: high, medium, or low` |

**Parameter 8:**
| Field | Value |
|-------|-------|
| Name | `notes` |
| Type | `string` |
| Required | YES |
| Description | `Brief AI-generated summary of the caller situation and key facts gathered during intake` |

### Server Settings

| Field | Value |
|-------|-------|
| **Server URL** | Leave blank for now (we will set after backend is deployed) |
| **Timeout** | `20` (default is fine) |

### Authorization
No authentication (leave default).

### HTTP Headers
Leave empty.

### Encryption Settings
Leave empty.

### Static Body Fields
Leave empty.

### Response Body
Leave empty.

### Aliases
Leave empty.

### Messages

| Stage | Message |
|-------|---------|
| **Request Start** | `Let me book that appointment for you right now.` |
| **Request Complete** | Leave empty (AI will confirm with the details naturally) |
| **Request Failed** | `I apologize, I'm having trouble booking the appointment right now. Let me take your details and someone from our office will call you back shortly to confirm.` |

---

## TOOL 3: transferCall (Predefined/Built-in)

Find this under "Predefined Functions" section, NOT custom functions.

| Field | Value |
|-------|-------|
| **Enable** | YES (toggle on) |
| **Description** | `Transfer the call to a human staff member when the caller insists on speaking to a person or when the situation is too complex or sensitive for AI handling.` |
| **Destination Number** | Leave blank for now (add the lawyer's real phone number later) |

### Messages

| Stage | Message |
|-------|---------|
| **Request Start** | `Let me transfer you to one of our team members right now. Please hold for just a moment.` |
| **Request Failed** | `I'm sorry, our team is currently unavailable. Can I take your name and number so someone can call you back as soon as possible?` |

---

## TOOL 4: endCall (Predefined/Built-in)

Find this under "Predefined Functions" section.

| Field | Value |
|-------|-------|
| **Enable** | YES (toggle on) |
| **Description** | `End the call after the conversation is complete, the caller says goodbye, or the caller requests to hang up.` |

---

## Fields You Can SKIP/IGNORE (leave default)

These are advanced features you don't need for MVP:

| Field | Why Skip |
|-------|----------|
| Lock schema | Not needed |
| Encrypted Paths | No sensitive data in tool calls |
| Static Body Fields | Not needed — all data comes from AI |
| Response Body variables | Not needed for MVP |
| Aliases | Not needed |
| Credential / Auth | Your backend will validate via VAPI headers instead |

---

## After Backend is Deployed

Come back and update these Server URLs:

| Tool | Server URL to Set |
|------|------------------|
| check_availability | `https://your-app.render.com/api/vapi/tool/check-availability` |
| book_appointment | `https://your-app.render.com/api/vapi/tool/book-appointment` |
| Assistant-level Server URL | `https://your-app.render.com/api/vapi/webhook` |
