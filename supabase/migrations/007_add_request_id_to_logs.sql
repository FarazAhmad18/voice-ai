ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON system_logs(request_id);
