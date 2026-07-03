-- Teacher API keys: long-lived credentials for programmatic access (exam CRUD)
-- Verified cross-schema by exam-service verifyAuth via the X-API-Key header.
-- Only the SHA-256 hash is stored; the plaintext key is shown once at creation.

CREATE TABLE IF NOT EXISTS quiz_users.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON quiz_users.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON quiz_users.api_keys (user_id, created_at DESC);
