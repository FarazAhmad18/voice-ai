-- ============================================================
-- Firm Knowledge Base / FAQ
-- Stores Q&A pairs per firm that get injected into the AI prompt
-- ============================================================

CREATE TABLE firm_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT DEFAULT 'general',
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_firm_knowledge_firm_id ON firm_knowledge(firm_id);

ALTER TABLE firm_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all" ON firm_knowledge FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
);

CREATE POLICY "firm_isolation" ON firm_knowledge FOR ALL USING (
  firm_id = (SELECT firm_id FROM users WHERE users.id = auth.uid())
);
