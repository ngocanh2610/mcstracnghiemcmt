CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT,
  service TEXT,
  resource_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);