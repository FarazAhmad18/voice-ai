-- System logs table for structured logging
CREATE TABLE IF NOT EXISTS system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID REFERENCES firms(id) ON DELETE SET NULL,
  level       TEXT NOT NULL,
  category    TEXT NOT NULL,
  message     TEXT NOT NULL,
  details     JSONB DEFAULT '{}',
  source      TEXT,
  call_id     TEXT,
  lead_id     TEXT,
  user_id     UUID,
  ip_address  TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_firm_id ON system_logs(firm_id);
CREATE INDEX idx_logs_level ON system_logs(level);
CREATE INDEX idx_logs_category ON system_logs(category);
CREATE INDEX idx_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX idx_logs_call_id ON system_logs(call_id);
