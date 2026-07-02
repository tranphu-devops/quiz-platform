-- Security: per-exam attempt limits and cooldown
ALTER TABLE quiz_exams.exams
  ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts     INTEGER DEFAULT NULL;
