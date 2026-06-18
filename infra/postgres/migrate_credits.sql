-- Credit system migration
ALTER TABLE quiz_users.profiles ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 20;
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS credit_cost INTEGER NOT NULL DEFAULT 10;

INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('default_credits', '20'),
  ('teacher_upgrade_cost', '100'),
  ('default_exam_cost', '10')
ON CONFLICT (key) DO NOTHING;
