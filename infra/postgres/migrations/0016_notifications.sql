-- Notification system: admin event alerts + per-user activity notifications,
-- delivered via Pushover/Email(Resend)/Telegram. notification-service owns
-- this schema and polls notification_queue as its own queue (Postgres,
-- not BullMQ/Redis — the shared redis service is a volatile allkeys-lru
-- cache, unsuitable for durable job storage).

CREATE SCHEMA IF NOT EXISTS quiz_notifications;

-- Catalog of notifiable events so the admin/user dashboards can render the
-- event x channel matrix without hardcoding labels in the frontend.
-- key convention: "<domain>.<event>.<audience>", e.g.
-- 'submission.completed.owner' (the student) vs 'submission.completed.admin'
-- (platform-wide ops visibility) — same business event, distinct opt-in.
CREATE TABLE IF NOT EXISTS quiz_notifications.event_types (
  key              TEXT PRIMARY KEY,
  audience         TEXT NOT NULL,   -- 'admin' | 'user'
  label_vi         TEXT NOT NULL,
  label_en         TEXT NOT NULL,
  label_ja         TEXT,            -- nullable; frontend falls back to label_en
  description_vi   TEXT,
  applicable_roles  TEXT[],          -- roles that may see/subscribe this row on /profile; NULL for admin-audience rows (any admin may subscribe)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user delivery credentials, kept in notification-service's own schema
-- rather than quiz_users.profiles — same boundary as quiz_generator.llm_keys
-- storing teacher LLM keys separately instead of bolting onto profiles.
CREATE TABLE IF NOT EXISTS quiz_notifications.user_channel_targets (
  user_id            UUID PRIMARY KEY,
  email_override     TEXT,   -- NULL = use auth.users.email at send time
  pushover_user_key  TEXT,
  telegram_chat_id   TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (user, event_type, channel) opt-in. Shared by both admin
-- "system event" subscriptions and regular user "my activity" preferences —
-- both reduce to the same shape, the audience distinction lives in the
-- event_type key itself (see event_types.audience), not a separate column.
CREATE TABLE IF NOT EXISTS quiz_notifications.notification_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  event_type  TEXT NOT NULL REFERENCES quiz_notifications.event_types(key),
  channel     TEXT NOT NULL,   -- 'pushover' | 'email' | 'telegram'
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_type, channel)
);
CREATE INDEX IF NOT EXISTS notification_subscriptions_lookup_idx
  ON quiz_notifications.notification_subscriptions (event_type, channel) WHERE enabled;

-- The queue itself. Producer services POST a resolved event to
-- notification-service's internal endpoint; fan-out (admin subscribers +
-- specific recipients) happens once at enqueue time, so every row here is
-- already a fully-resolved (recipient, channel) send target — the worker
-- never re-joins subscriptions per tick.
CREATE TABLE IF NOT EXISTS quiz_notifications.notification_queue (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         TEXT NOT NULL,
  channel            TEXT NOT NULL,
  recipient_user_id  UUID,
  payload            JSONB NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | sent | failed | dead
  attempts           INT NOT NULL DEFAULT 0,
  max_attempts       INT NOT NULL DEFAULT 5,
  last_error         TEXT,
  available_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- backoff gate; worker only claims rows where available_at <= NOW()
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notification_queue_poll_idx
  ON quiz_notifications.notification_queue (available_at) WHERE status = 'pending';

-- Seed the v1 event catalog: 8 business events, most split admin/user,
-- submission completed/timed_out split 3 ways (admin, owner=student,
-- teacher=exam owner).
INSERT INTO quiz_notifications.event_types (key, audience, label_vi, label_en, applicable_roles) VALUES
  ('submission.completed.admin',        'admin', 'Có bài nộp mới hoàn thành',        'Submission completed',          NULL),
  ('submission.completed.owner',        'user',  'Kết quả bài thi của bạn',          'Your exam result',              '{student,teacher,admin}'),
  ('submission.completed.teacher',      'user',  'Học sinh vừa nộp bài đề của bạn',  'A student submitted your exam', '{teacher,admin}'),
  ('submission.timed_out.admin',        'admin', 'Có bài thi hết giờ tự động nộp',   'Submission auto-submitted (timed out)', NULL),
  ('submission.timed_out.owner',        'user',  'Bài thi của bạn đã hết giờ',       'Your exam timed out',           '{student,teacher,admin}'),
  ('submission.timed_out.teacher',      'user',  'Bài thi đề của bạn vừa hết giờ',   'A submission on your exam timed out', '{teacher,admin}'),
  ('badge.earned.admin',                'admin', 'Có học sinh đạt huy hiệu mới',     'Student earned a badge',        NULL),
  ('badge.earned.owner',                'user',  'Bạn vừa đạt huy hiệu mới',         'You earned a badge',            '{student,teacher,admin}'),
  ('report.filed.admin',                'admin', 'Có báo cáo đề thi mới',            'New exam report filed',         NULL),
  ('report.filed.teacher',              'user',  'Đề thi của bạn bị báo cáo',        'Your exam was reported',        '{teacher,admin}'),
  ('report.resolved.admin',             'admin', 'Báo cáo đã được xử lý',            'Report resolved',               NULL),
  ('report.resolved.reporter',          'user',  'Báo cáo của bạn đã được phản hồi', 'Your report was resolved',      '{student,teacher,admin}'),
  ('generation.completed.admin',        'admin', 'Có đề thi AI tạo thành công',      'AI generation completed',       NULL),
  ('generation.completed.owner',        'user',  'Đề thi AI của bạn đã tạo xong',    'Your AI-generated exam is ready', '{teacher,admin}'),
  ('generation.failed.admin',           'admin', 'Có phiên tạo đề AI thất bại',      'AI generation failed',          NULL),
  ('generation.failed.owner',           'user',  'Tạo đề AI của bạn thất bại',       'Your AI generation failed',     '{teacher,admin}'),
  ('credit.deduct_failed.admin',        'admin', 'Có giao dịch trừ credit thất bại', 'Credit deduction failed',       NULL),
  ('credit.deduct_failed.owner',        'user',  'Không đủ credit để thực hiện',     'Insufficient credit',           '{student,teacher,admin}'),
  ('teacher_upgrade.succeeded.admin',   'admin', 'Có tài khoản nâng cấp lên giáo viên', 'A user upgraded to teacher',  NULL),
  ('teacher_upgrade.succeeded.owner',   'user',  'Bạn đã nâng cấp thành công lên giáo viên', 'You upgraded to teacher', '{teacher,admin}')
ON CONFLICT (key) DO NOTHING;
