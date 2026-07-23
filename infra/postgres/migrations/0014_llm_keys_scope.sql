-- Admin-managed platform-wide OpenRouter key (in addition to teacher-supplied
-- "own" keys already in llm_keys) plus an admin-configurable default model
-- for platform-key generations. scope distinguishes the two: 'user' rows are
-- unchanged (a teacher's own BYO key, selected by user_id); 'platform' rows
-- hold the org-wide key set by an admin (selected by scope, not user_id —
-- user_id is kept as the creating admin for audit only).
ALTER TABLE quiz_generator.llm_keys ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS llm_keys_scope_idx ON quiz_generator.llm_keys (scope, created_at DESC) WHERE revoked_at IS NULL;

INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('ai_generation_default_model', 'anthropic/claude-sonnet-5')
ON CONFLICT (key) DO NOTHING;
