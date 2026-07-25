-- Referral credit system.
-- Each user gets a short referral_code. New users signing up via a referral
-- link give the referrer a claimable reward, and (two-sided) receive a signup
-- bonus credited directly on account creation.

-- 1. Referral code on profiles: add nullable, backfill existing rows, then set a
--    DB DEFAULT so every future INSERT into profiles auto-generates one.
ALTER TABLE quiz_users.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

UPDATE quiz_users.profiles
  SET referral_code = upper(substr(md5(id::text || random()::text), 1, 8))
  WHERE referral_code IS NULL;

ALTER TABLE quiz_users.profiles
  ALTER COLUMN referral_code
  SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON quiz_users.profiles (referral_code);

-- 2. Referral records. One row per referred user (UNIQUE), so a user can only be
--    attributed once. claimed_at NULL = the referrer hasn't claimed the reward yet.
--    Reward is computed at claim time from the current admin setting (not snapshot
--    at signup); claimed_reward records what was actually paid, for audit.
CREATE TABLE IF NOT EXISTS quiz_users.referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL,
  referred_user_id  UUID NOT NULL UNIQUE,
  claimed_at        TIMESTAMPTZ,
  claimed_reward    INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON quiz_users.referrals (referrer_id);

-- 3. Admin-tunable amounts (same key/value store as other credit config).
INSERT INTO quiz_users.admin_settings (key, value) VALUES
  ('referral_reward_credits', '20'),        -- paid to the referrer per referral, at claim time
  ('referral_signup_bonus_credits', '10')   -- credited directly to the new user on signup
ON CONFLICT (key) DO NOTHING;

-- 4. Notification event: referrer alerted when someone signs up via their link.
--    Shape mirrors the seed in 0016_notifications.sql.
INSERT INTO quiz_notifications.event_types (key, audience, label_vi, label_en, applicable_roles) VALUES
  ('referral.completed.owner', 'user', 'Có người đăng ký qua link giới thiệu của bạn', 'Someone signed up with your referral link', '{student,teacher,admin}')
ON CONFLICT (key) DO NOTHING;
