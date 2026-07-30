-- Public, SEO-indexable exam pages: URL slugs + content language + updated_at.
--
-- Serves novaquiz.net/{lang}/exams/{slug}. Three things are needed:
--   1. a stable, ASCII, human-readable slug per exam (UUIDs are useless as URLs)
--   2. a content language, so each exam is published under exactly one language
--      prefix and <html lang> is truthful
--   3. an updated_at, so <lastmod> in the sitemap can actually move — created_at
--      never changes, which tells crawlers "never re-crawl this"
--
-- NOTE: this is the first migration in the repo to add a FUNCTION and a TRIGGER.
-- The trigger is deliberate, not convenience: quiz_exams.exams has three
-- independent writers — POST /exams (exam-service), generator-service (which
-- goes through POST /exams), and the SQL seed files (seed.sql, seed_aws_saa.sql,
-- seed_exam_01.sql, ~106 rows). Generating slugs in JS only would leave every
-- local `docker compose up` with ~106 slug-less exams and zero working public
-- pages, and would put the same logic in three places.

-- ── slugify ──────────────────────────────────────────────────────────────
-- WARNING: never store this function's output in a GENERATED column or an
-- expression index. It is IMMUTABLE only by declaration; the diacritic table
-- below is the kind of thing that gets tweaked, and a CREATE OR REPLACE would
-- then silently desynchronise any persisted value from the function.
--
-- Both letter cases are mapped BEFORE lower(). docker-compose.yml sets no
-- LC_*/POSTGRES_INITDB_ARGS, so the database collation may effectively be C,
-- where lower() is a no-op on non-ASCII input — lowercasing first would leave
-- 'Lịch' as 'Lịch' and produce a percent-encoded slug. Mapping first makes the
-- string pure ASCII, after which lower() is locale-independent.
--
-- Input is assumed to be NFC (precomposed), which is what Postgres stores for
-- text inserted by the app. NFD input degrades gracefully: the combining marks
-- fall into the [^a-z0-9] class and become hyphens, so the slug is ugly but
-- still ASCII and still unique.
CREATE OR REPLACE FUNCTION quiz_exams.slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            input,
            'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
            || 'ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ',
            'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
            || 'AAAAAAAAAAAAAAAAAEEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUUYYYYYD'
          )
        ),
        '[^a-z0-9]+', '-', 'g'    -- collapses spaces, punctuation and the em-dash in seeded titles
      ),
      '-{2,}', '-', 'g'
    ),
    '-'
  )
$$;

COMMENT ON FUNCTION quiz_exams.slugify(TEXT) IS
  'Vietnamese-aware ASCII slug. Do not use in generated columns or expression indexes.';

-- ── columns ──────────────────────────────────────────────────────────────
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS slug       TEXT;
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS language   TEXT NOT NULL DEFAULT 'vi';
ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ADD CONSTRAINT has no IF NOT EXISTS; the migration must stay re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_language_chk') THEN
    ALTER TABLE quiz_exams.exams
      ADD CONSTRAINT exams_language_chk CHECK (language IN ('vi', 'en', 'ja'));
  END IF;
END $$;

UPDATE quiz_exams.exams SET updated_at = created_at WHERE updated_at IS NULL;

-- ── slug uniqueness ──────────────────────────────────────────────────────
-- Full index, not partial on deleted_at IS NULL: a soft-deleted exam KEEPS its
-- slug so the URL can never be recycled onto a different exam. Serving a 200
-- with unrelated content at a previously indexed URL is the worst form of
-- link rot. NULLs do not conflict in a B-tree, so this can be created before
-- the backfill.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exams_slug ON quiz_exams.exams(slug);

-- ── backfill ─────────────────────────────────────────────────────────────
-- Deterministic and re-runnable. On a base-slug collision the earliest row
-- (created_at, id) keeps the clean slug and every other row gets the first 8
-- hex digits of its own uuid appended. A -2/-3 counter is NOT used: it is not
-- stable across re-runs or later inserts, so the same suffix could end up on a
-- different exam.
--
-- 'exams' and 'topics' are reserved because they are static segments in the
-- SvelteKit route tree (/{lang}/exams, /{lang}/exams/topics/{tag}).
WITH candidate AS (
  SELECT id,
         NULLIF(quiz_exams.slugify(title), '') AS base,
         ROW_NUMBER() OVER (PARTITION BY quiz_exams.slugify(title)
                            ORDER BY created_at, id) AS rn
  FROM quiz_exams.exams
  WHERE slug IS NULL
)
UPDATE quiz_exams.exams e
SET slug = CASE
             WHEN c.base IS NULL
               OR c.base IN ('exams', 'topics')
               OR c.rn > 1
               THEN COALESCE(c.base, 'de') || '-' || left(replace(e.id::text, '-', ''), 8)
             ELSE c.base
           END
FROM candidate c
WHERE c.id = e.id;

-- ── keep slugs filled, and immutable ────────────────────────────────────
CREATE OR REPLACE FUNCTION quiz_exams.exams_fill_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base       TEXT;
  candidate  TEXT;
  suffix     TEXT;
  attempt    INT := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Slugs are immutable. Renaming an exam is a cheap, frequent action; if the
    -- slug followed the title, every rename would 404 an indexed URL and throw
    -- away whatever ranking it had earned. The cost of immutability is a slug
    -- that no longer matches the title — far cheaper than link rot plus a
    -- redirect table.
    NEW.slug := OLD.slug;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := COALESCE(NEW.created_at, NOW());
  END IF;

  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  suffix := left(replace(NEW.id::text, '-', ''), 8);
  base   := NULLIF(quiz_exams.slugify(NEW.title), '');
  IF base IS NULL OR base IN ('exams', 'topics') THEN
    candidate := COALESCE(base, 'de') || '-' || suffix;
  ELSE
    candidate := base;
  END IF;

  WHILE EXISTS (SELECT 1 FROM quiz_exams.exams WHERE slug = candidate) LOOP
    attempt := attempt + 1;
    IF attempt > 5 THEN
      RAISE EXCEPTION 'could not derive a unique slug for exam % (base %)', NEW.id, base;
    END IF;
    candidate := COALESCE(base, 'de') || '-' || suffix
                 || CASE WHEN attempt = 1 THEN '' ELSE '-' || attempt::text END;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_exams_fill_slug ON quiz_exams.exams;
CREATE TRIGGER trg_exams_fill_slug
  BEFORE INSERT OR UPDATE ON quiz_exams.exams
  FOR EACH ROW EXECUTE FUNCTION quiz_exams.exams_fill_slug();

-- Safe only now that both the backfill and the trigger are in place.
ALTER TABLE quiz_exams.exams ALTER COLUMN slug SET NOT NULL;

-- ── indexes for the public queries ──────────────────────────────────────
-- The pre-existing idx_exams_not_deleted is on (id), which is already the PK,
-- so nothing today supports the published/language/newest-first scan.
CREATE INDEX IF NOT EXISTS idx_exams_public_lang_created
  ON quiz_exams.exams (language, created_at DESC)
  WHERE is_published = true AND deleted_at IS NULL;

-- Topic hubs match on slugify(tag), which cannot use this index directly, but
-- tag containment filters and the distinct-tag rollup do.
CREATE INDEX IF NOT EXISTS idx_exams_tags_gin
  ON quiz_exams.exams USING GIN (tags);
