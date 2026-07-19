-- AI exam generator: teacher uploads a document, generator-service calls an
-- LLM to draft an exam, then imports it via exam-service's own Teacher API
-- routes (forwarding the teacher's JWT), so exam-service itself is unchanged.

CREATE SCHEMA IF NOT EXISTS quiz_generator;

-- Teacher-supplied ("bring your own") LLM API keys. encrypted_key is
-- reversible (AES-256-GCM, see src/lib/keyCrypto.js) — unlike
-- quiz_users.api_keys (one-way SHA-256 hash), the plaintext must be
-- recoverable to actually call the provider on the teacher's behalf.
CREATE TABLE IF NOT EXISTS quiz_generator.llm_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  encrypted_key TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS llm_keys_user_idx ON quiz_generator.llm_keys (user_id, created_at DESC);

-- One row per generation attempt — audit trail + history shown on the
-- generate page. exam_id is not FK'd (cross-schema, exam lives in
-- quiz_exams) and is null until the import into exam-service succeeds.
CREATE TABLE IF NOT EXISTS quiz_generator.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  key_source TEXT NOT NULL,
  model TEXT NOT NULL,
  source_filename TEXT,
  source_file_type TEXT,
  question_count INT,
  exam_id UUID,
  credits_charged INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS generation_jobs_user_idx ON quiz_generator.generation_jobs (user_id, created_at DESC);

-- Admin-configurable feature flag + cost/limits, read at runtime by
-- generator-service (same admin_settings pattern as upload/credit config).
INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('ai_generation_enabled', 'false'),
  ('ai_generation_credit_cost', '5'),
  ('ai_generation_max_file_size_mb', '20'),
  ('ai_generation_max_questions', '30')
ON CONFLICT (key) DO NOTHING;
