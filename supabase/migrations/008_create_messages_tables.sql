-- Messages table (SMS, email, internal notes — unified timeline)
CREATE TABLE IF NOT EXISTS messages (
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

CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_firm_id ON messages(firm_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all" ON messages;
DROP POLICY IF EXISTS "firm_isolation" ON messages;

CREATE POLICY "super_admin_all" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);

CREATE POLICY "firm_isolation" ON messages FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);

-- Message templates (quick-reply templates)
CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID REFERENCES firms(id) ON DELETE CASCADE,  -- null = global template
  industry    TEXT,
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'sms',
  subject     TEXT,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all" ON message_templates;
DROP POLICY IF EXISTS "firm_isolation" ON message_templates;

CREATE POLICY "super_admin_all" ON message_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);

CREATE POLICY "firm_isolation" ON message_templates FOR ALL USING (
  firm_id IS NULL OR firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
