-- Soft-delete support for exams, questions, collections
-- deleted_at IS NULL  → active record
-- deleted_at NOT NULL → soft-deleted (excluded from all app queries)

ALTER TABLE quiz_exams.exams       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE quiz_exams.questions   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE quiz_exams.collections ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial indexes: fast WHERE deleted_at IS NULL scans
CREATE INDEX IF NOT EXISTS idx_exams_not_deleted       ON quiz_exams.exams(id)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_not_deleted   ON quiz_exams.questions(exam_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_not_deleted ON quiz_exams.collections(id)   WHERE deleted_at IS NULL;
