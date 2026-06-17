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
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  points FLOAT DEFAULT 1.0,
  order_index INT DEFAULT 0,
  explanation TEXT,
  question_type TEXT DEFAULT 'single'
);

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
