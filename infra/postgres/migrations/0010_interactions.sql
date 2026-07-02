-- Interactions service: comments / likes / reports
-- Apply to an existing running database:
--   docker compose exec postgres psql -U postgres -d quizdb -f /dev/stdin < infra/postgres/migrate_interactions.sql

CREATE SCHEMA IF NOT EXISTS quiz_interactions;

-- Comments: any authenticated user may comment on an exam
CREATE TABLE IF NOT EXISTS quiz_interactions.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comments_exam_created_idx
  ON quiz_interactions.comments (exam_id, created_at DESC);

-- Likes: students only; one heart per user per exam
CREATE TABLE IF NOT EXISTS quiz_interactions.likes (
  exam_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (exam_id, user_id)
);

-- Reports: filed by users who finished the exam; tracked history + owner response
CREATE TABLE IF NOT EXISTS quiz_interactions.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  exam_owner_id UUID NOT NULL,
  reporter_id UUID NOT NULL,
  category VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  response TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reports_owner_status_idx
  ON quiz_interactions.reports (exam_owner_id, status);
CREATE INDEX IF NOT EXISTS reports_reporter_idx
  ON quiz_interactions.reports (reporter_id, created_at DESC);
