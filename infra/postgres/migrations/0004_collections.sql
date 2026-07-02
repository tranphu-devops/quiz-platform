-- Collections: groups of exams with a badge reward
CREATE TABLE IF NOT EXISTS quiz_exams.collections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  created_by   UUID        NOT NULL,
  badge_image_url TEXT,
  is_published BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_exams.collection_exams (
  collection_id UUID NOT NULL REFERENCES quiz_exams.collections(id) ON DELETE CASCADE,
  exam_id       UUID NOT NULL REFERENCES quiz_exams.exams(id)        ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, exam_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_exams_exam ON quiz_exams.collection_exams(exam_id);

-- Student badges earned from completing collections
CREATE TABLE IF NOT EXISTS quiz_submissions.student_badges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  collection_id UUID        NOT NULL,
  earned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, collection_id)
);
CREATE INDEX IF NOT EXISTS idx_student_badges_user ON quiz_submissions.student_badges(user_id);
