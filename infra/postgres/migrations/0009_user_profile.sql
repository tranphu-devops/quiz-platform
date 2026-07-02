-- Add personal profile fields to quiz_users.profiles
ALTER TABLE quiz_users.profiles
  ADD COLUMN IF NOT EXISTS bio            TEXT,
  ADD COLUMN IF NOT EXISTS birth_year     SMALLINT,
  ADD COLUMN IF NOT EXISTS gender         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS interests      TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS zalo           VARCHAR(30),
  ADD COLUMN IF NOT EXISTS tiktok_url     VARCHAR(500),
  ADD COLUMN IF NOT EXISTS youtube_url    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS instagram_url  VARCHAR(500),
  ADD COLUMN IF NOT EXISTS linkedin_url   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS website_url    VARCHAR(500);
