-- Add progress-tracking columns to submissions
-- status: in_progress | completed | timed_out  (DEFAULT 'completed' keeps existing rows intact)
-- started_at / expires_at: set at POST /submissions/start for time-limit enforcement
-- answers is made nullable so in_progress rows can start with no answers yet

ALTER TABLE quiz_submissions.submissions
  ADD COLUMN IF NOT EXISTS status     VARCHAR(20) NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE quiz_submissions.submissions
  ALTER COLUMN answers SET DEFAULT '{}'::jsonb;
