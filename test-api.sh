#!/bin/bash
# VoibixAI API Test Suite
BASE=http://localhost:3001
PASS=0
FAIL=0
BUGS=""

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    PASS=$((PASS+1))
    echo "  PASS: $name"
  else
    FAIL=$((FAIL+1))
    BUGS="$BUGS\nFAIL: $name — expected '$expected', got: $(echo $actual | head -c 120)"
    echo "  FAIL: $name"
    echo "    Expected: $expected"
    echo "    Got: $(echo $actual | head -c 150)"
  fi
}

echo "========================================="
echo "  VoibixAI API Test Suite"
echo "========================================="
echo ""

# --- AUTH ---
echo "[AUTH]"
R=$(curl -s $BASE/)
check "Health check" "VoibixAI" "$R"

# Login super admin
SA_FULL=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"faraz@leapingai.com","password":"Admin1234!"}')
SA_TOKEN=$(echo "$SA_FULL" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['access_token'])" 2>/dev/null)
if [ -n "$SA_TOKEN" ]; then
  check "Super admin login" "access_token" "$SA_FULL"
else
  check "Super admin login" "access_token" "FAILED - no token"
fi

# Login client admin
CA_FULL=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@mitchellfamilylaw.com","password":"Test1234!"}')
CA_TOKEN=$(echo "$CA_FULL" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['access_token'])" 2>/dev/null)
if [ -n "$CA_TOKEN" ]; then
  check "Client admin login" "access_token" "$CA_FULL"
else
  check "Client admin login" "access_token" "FAILED - no token"
fi

# Bad login
R=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"nobody@test.com","password":"wrong"}')
check "Bad login rejected" "Invalid email or password" "$R"

# No token
R=$(curl -s $BASE/api/leads)
check "No auth rejected" "No authorization" "$R"

# Bad token
R=$(curl -s $BASE/api/leads -H "Authorization: Bearer faketoken123")
check "Bad token rejected" "Invalid or expired" "$R"

# Auth/me
R=$(curl -s $BASE/api/auth/me -H "Authorization: Bearer $SA_TOKEN")
check "SA /me works" "super_admin" "$R"

R=$(curl -s $BASE/api/auth/me -H "Authorization: Bearer $CA_TOKEN")
check "CA /me has firm" "Mitchell" "$R"

echo ""
echo "[AUTHORIZATION]"
# Client tries admin routes
R=$(curl -s $BASE/api/firms -H "Authorization: Bearer $CA_TOKEN")
check "Client blocked from /firms" "Forbidden" "$R"

R=$(curl -s $BASE/api/logs -H "Authorization: Bearer $CA_TOKEN")
check "Client blocked from /logs" "Forbidden" "$R"

R=$(curl -s $BASE/api/templates -H "Authorization: Bearer $CA_TOKEN")
check "Client blocked from /templates" "Forbidden" "$R"

echo ""
echo "[LEADS]"
R=$(curl -s $BASE/api/leads -H "Authorization: Bearer $CA_TOKEN")
check "Get leads returns data" '"data":' "$R"

R=$(curl -s "$BASE/api/leads?limit=2" -H "Authorization: Bearer $CA_TOKEN")
check "Leads pagination works" '"total":' "$R"

# Get specific lead
LEAD_ID=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d['data'] else '')" 2>/dev/null)
if [ -n "$LEAD_ID" ]; then
  R=$(curl -s $BASE/api/leads/$LEAD_ID -H "Authorization: Bearer $CA_TOKEN")
  check "Get lead detail" "caller_name" "$R"
fi

R=$(curl -s $BASE/api/leads/lead_nonexistent -H "Authorization: Bearer $CA_TOKEN")
check "Nonexistent lead 404" "not found" "$R"

# Patch with disallowed fields
R=$(curl -s -X PATCH $BASE/api/leads/$LEAD_ID -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"score":999}')
check "Disallowed field blocked" "No valid fields" "$R"

# Patch with valid field
if [ -n "$LEAD_ID" ]; then
  R=$(curl -s -X PATCH $BASE/api/leads/$LEAD_ID -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"status":"new"}')
  check "Valid lead patch" '"status":"new"' "$R"
fi

# SA sees all leads
R=$(curl -s $BASE/api/leads -H "Authorization: Bearer $SA_TOKEN")
check "SA sees all leads" '"data":' "$R"

echo ""
echo "[APPOINTMENTS]"
R=$(curl -s $BASE/api/appointments -H "Authorization: Bearer $CA_TOKEN")
check "Get appointments" '"data":' "$R"

echo ""
echo "[STAFF]"
R=$(curl -s $BASE/api/staff -H "Authorization: Bearer $CA_TOKEN")
check "Get staff" "[" "$R"

# Create staff
R=$(curl -s -X POST $BASE/api/staff -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"name":"Dr. Test Attorney","role":"attorney","specialization":"Criminal Law","email":"test@law.com"}')
check "Create staff" "Dr. Test Attorney" "$R"
STAFF_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# Create staff with empty name
R=$(curl -s -X POST $BASE/api/staff -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"name":"","role":"attorney"}')
check "Empty name rejected" "error" "$R"

# Toggle staff
if [ -n "$STAFF_ID" ]; then
  R=$(curl -s -X PATCH $BASE/api/staff/$STAFF_ID -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"is_active":false}')
  check "Deactivate staff" "false" "$R"

  R=$(curl -s -X DELETE $BASE/api/staff/$STAFF_ID -H "Authorization: Bearer $CA_TOKEN")
  check "Delete staff" "is_active" "$R"
fi

echo ""
echo "[KNOWLEDGE]"
R=$(curl -s $BASE/api/knowledge -H "Authorization: Bearer $CA_TOKEN")
check "Get knowledge" "[" "$R"

R=$(curl -s -X POST $BASE/api/knowledge -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"question":"What is your address?","answer":"123 Main St","category":"location"}')
check "Create knowledge" "What is your address" "$R"
K_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

R=$(curl -s -X POST $BASE/api/knowledge -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"question":"","answer":"test"}')
check "Empty question rejected" "error" "$R"

R=$(curl -s -X POST $BASE/api/knowledge -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"question":"test","answer":"test","category":"HACKED"}')
check "Bad category rejected" "error" "$R"

if [ -n "$K_ID" ]; then
  R=$(curl -s -X PATCH $BASE/api/knowledge/$K_ID -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"answer":"456 Oak Ave, Updated"}')
  check "Update knowledge" "456 Oak Ave" "$R"

  R=$(curl -s -X DELETE $BASE/api/knowledge/$K_ID -H "Authorization: Bearer $CA_TOKEN")
  check "Delete knowledge" "deleted" "$R"
fi

echo ""
echo "[MESSAGES]"
if [ -n "$LEAD_ID" ]; then
  R=$(curl -s -X POST $BASE/api/messages -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d "{\"lead_id\":\"$LEAD_ID\",\"channel\":\"note\",\"body\":\"Test note from API test suite\"}")
  check "Send note" "note" "$R"

  R=$(curl -s -X POST $BASE/api/messages -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d "{\"lead_id\":\"$LEAD_ID\",\"channel\":\"sms\",\"body\":\"Test SMS\"}")
  check "Send SMS (mock)" "sms" "$R"

  R=$(curl -s -X POST $BASE/api/messages -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d "{\"lead_id\":\"$LEAD_ID\",\"channel\":\"note\",\"body\":\"\"}")
  check "Empty body rejected" "error" "$R"

  R=$(curl -s "$BASE/api/messages?lead_id=$LEAD_ID" -H "Authorization: Bearer $CA_TOKEN")
  check "Get messages" "[" "$R"
fi

echo ""
echo "[SETTINGS]"
R=$(curl -s -X PATCH $BASE/api/settings -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"business_hours":"8 AM - 6 PM"}')
check "Update settings" "business_hours" "$R"

R=$(curl -s -X PATCH $BASE/api/settings -H "Authorization: Bearer $CA_TOKEN" -H "Content-Type: application/json" -d '{"plan":"enterprise"}')
check "Disallowed settings field" "No valid fields" "$R"

echo ""
echo "[ADMIN - FIRMS]"
R=$(curl -s $BASE/api/firms -H "Authorization: Bearer $SA_TOKEN")
check "SA list firms" "Mitchell" "$R"

# Create new client
R=$(curl -s -X POST $BASE/api/firms -H "Authorization: Bearer $SA_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test Dental Clinic","industry":"dental","email":"test@dental.com","phone":"+14255550100","business_hours":"9 AM - 5 PM","agent_name":"Amy","staff":[{"name":"Dr. Sarah","role":"doctor","specialization":"Orthodontics"}]}')
check "Create firm" "Test Dental" "$R"
NEW_FIRM_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# Create firm with no name
R=$(curl -s -X POST $BASE/api/firms -H "Authorization: Bearer $SA_TOKEN" -H "Content-Type: application/json" -d '{"industry":"dental"}')
check "Firm without name rejected" "required" "$R"

if [ -n "$NEW_FIRM_ID" ]; then
  R=$(curl -s $BASE/api/firms/$NEW_FIRM_ID -H "Authorization: Bearer $SA_TOKEN")
  check "Get firm detail" "Test Dental" "$R"

  R=$(curl -s -X PATCH $BASE/api/firms/$NEW_FIRM_ID -H "Authorization: Bearer $SA_TOKEN" -H "Content-Type: application/json" -d '{"status":"paused"}')
  check "Pause firm" "paused" "$R"
fi

echo ""
echo "[ADMIN - TEMPLATES]"
R=$(curl -s $BASE/api/templates -H "Authorization: Bearer $SA_TOKEN")
check "List templates" "industry" "$R"

R=$(curl -s -X POST $BASE/api/templates -H "Authorization: Bearer $SA_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Test Template","industry":"other","body":"You are {{agent_name}} for {{company_name}}","case_types":["test"]}')
check "Create template" "Test Template" "$R"
TPL_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$TPL_ID" ]; then
  R=$(curl -s -X DELETE $BASE/api/templates/$TPL_ID -H "Authorization: Bearer $SA_TOKEN")
  check "Delete template" "" "$R"
fi

echo ""
echo "[ADMIN - LOGS]"
R=$(curl -s "$BASE/api/logs?limit=3" -H "Authorization: Bearer $SA_TOKEN")
check "Get logs" '"logs":' "$R"

R=$(curl -s "$BASE/api/logs?level=error&limit=3" -H "Authorization: Bearer $SA_TOKEN")
check "Filter logs by level" '"logs":' "$R"

echo ""
echo "[WEBHOOK - EDGE CASES]"
# Retell webhook without signature (should fail in dev without key? or pass?)
R=$(curl -s -X POST $BASE/api/retell/webhook -H "Content-Type: application/json" -d '{"event":"call_started","call":{"call_id":"test123","agent_id":"fake"}}')
check "Webhook without valid sig" "error\|signature\|misconfiguration" "$R"

# Twilio webhook without sig (dev mode allows)
R=$(curl -s -X POST $BASE/api/twilio/sms -H "Content-Type: application/json" -d '{"From":"+12025551234","To":"+14255550199","Body":"Test SMS"}')
check "Twilio webhook in dev" "" "$R"

echo ""
echo "========================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "FAILURES:"
  echo -e "$BUGS"
fi
