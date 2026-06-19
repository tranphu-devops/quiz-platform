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
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
