-- Scheduled publish: allow exams to be visible but locked until a future datetime
ALTER TABLE quiz_exams.exams
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;
