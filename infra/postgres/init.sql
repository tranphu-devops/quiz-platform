-- Auth schema: GoTrue manages its own tables here on startup
CREATE SCHEMA IF NOT EXISTS auth;

-- Legacy alias (unused but kept for search_path compat)
CREATE SCHEMA IF NOT EXISTS quiz_auth;

-- User profiles
CREATE SCHEMA IF NOT EXISTS quiz_users;

CREATE TABLE IF NOT EXISTS quiz_users.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  bio TEXT,
  birth_year SMALLINT,
  gender VARCHAR(20),
  interests TEXT,
  facebook_url VARCHAR(500),
  zalo VARCHAR(30),
  tiktok_url VARCHAR(500),
  youtube_url VARCHAR(500),
  instagram_url VARCHAR(500),
  linkedin_url VARCHAR(500),
  website_url VARCHAR(500)
);

-- Exams
CREATE SCHEMA IF NOT EXISTS quiz_exams;

CREATE TABLE IF NOT EXISTS quiz_exams.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  time_limit INT DEFAULT 30,
  passing_score FLOAT,
  created_by UUID NOT NULL,
  is_published BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  show_explanation BOOLEAN DEFAULT false,
  allow_retake BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_exams.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES quiz_exams.exams(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  points FLOAT DEFAULT 1.0,
  order_index INT DEFAULT 0,
  explanation TEXT,
  question_type TEXT DEFAULT 'single'
);

-- Migrations for existing databases
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE quiz_exams.questions ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- Admin settings (key-value store for upload validation config)
CREATE TABLE IF NOT EXISTS quiz_users.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('upload_max_size_mb', '5'),
  ('upload_allowed_types', 'image/jpeg,image/png,image/webp,image/gif')
ON CONFLICT (key) DO NOTHING;

-- Submissions
CREATE SCHEMA IF NOT EXISTS quiz_submissions;

CREATE TABLE IF NOT EXISTS quiz_submissions.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL,
  score FLOAT,
  total_points FLOAT,
  percentage FLOAT,
  results_detail JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interactions (comments / likes / reports)
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
  exam_owner_id UUID NOT NULL,           -- denormalized exams.created_by (fast inbox filter)
  reporter_id UUID NOT NULL,
  category VARCHAR(40) NOT NULL,         -- question_wrong | answer_wrong | image_issue | other
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',   -- open | resolved
  response TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reports_owner_status_idx
  ON quiz_interactions.reports (exam_owner_id, status);
CREATE INDEX IF NOT EXISTS reports_reporter_idx
  ON quiz_interactions.reports (reporter_id, created_at DESC);
