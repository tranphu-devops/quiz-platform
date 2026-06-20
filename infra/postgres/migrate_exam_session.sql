-- Adds per-submission session tracking to prevent concurrent sessions on the same exam.
-- exam_session_id: UUID generated each time a device claims this in_progress submission.
-- session_last_active: updated by every PUT /progress heartbeat; used to detect stale sessions.
ALTER TABLE quiz_submissions.submissions
  ADD COLUMN IF NOT EXISTS exam_session_id    UUID,
  ADD COLUMN IF NOT EXISTS session_last_active TIMESTAMPTZ;
