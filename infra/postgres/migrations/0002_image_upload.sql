-- Run this against an existing database to add image upload support
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE quiz_exams.questions ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS quiz_users.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('upload_max_size_mb', '5'),
  ('upload_allowed_types', 'image/jpeg,image/png,image/webp,image/gif')
ON CONFLICT (key) DO NOTHING;
