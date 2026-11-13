-- At most one in_progress submission per (exam, user).
--
-- POST /submissions/start used to check for an existing row and then insert —
-- two concurrent requests could both pass the check, both be charged, and
-- leave two live attempts. The index makes the second insert fail instead;
-- the route inserts before charging, so nothing is deducted for the loser.

-- Existing duplicates would make the index creation fail, so close all but
-- the newest of each group first. They are marked timed_out with a zero
-- score rather than graded: the surviving row is the attempt in use.
UPDATE quiz_submissions.submissions s
   SET status = 'timed_out', score = 0, total_points = 0, percentage = 0, submitted_at = NOW()
 WHERE s.status = 'in_progress'
   AND EXISTS (
     SELECT 1 FROM quiz_submissions.submissions n
      WHERE n.exam_id = s.exam_id AND n.user_id = s.user_id
        AND n.status = 'in_progress'
        AND (COALESCE(n.started_at, 'epoch'), n.id) > (COALESCE(s.started_at, 'epoch'), s.id)
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_one_in_progress
  ON quiz_submissions.submissions (exam_id, user_id)
  WHERE status = 'in_progress';

-- The grader polls this every minute.
CREATE INDEX IF NOT EXISTS idx_submissions_in_progress_expiry
  ON quiz_submissions.submissions (expires_at)
  WHERE status = 'in_progress';
