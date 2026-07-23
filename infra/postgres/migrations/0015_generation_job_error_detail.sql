-- Structured error detail for failed generation attempts, alongside the
-- existing plain-text error_message. Populated with whatever the failure
-- source provides (OpenRouter API error code/message/metadata, truncation
-- info, exam-service import error, JSON parse failure) so the job history
-- UI can show more than a one-line message.
ALTER TABLE quiz_generator.generation_jobs ADD COLUMN IF NOT EXISTS error_detail JSONB;
