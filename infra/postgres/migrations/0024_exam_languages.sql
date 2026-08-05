-- Multi-language exams: an exam may be offered in more than one language.
--
-- 0023 added a single `language` for the public SEO pages, where one exam maps
-- to exactly one /{lang}/exams/{slug} URL. That constraint has to survive:
-- listing the same exam under two language prefixes would publish duplicate
-- content at two indexable URLs and make the hreflang set (which promises
-- *translations*, not copies) a lie.
--
-- So `languages` is the full set the exam is offered in — used by the in-app
-- catalog filter — and `language` stays the ONE primary language that owns the
-- public URL and <html lang>. The invariant is `language = languages[1]`:
-- element 1 is the primary, the rest are secondary. It is a CHECK, not a
-- trigger, because unlike slug (0023) nothing but exam-service ever writes
-- these columns — the seed files insert neither and take both defaults, which
-- already satisfy it. A writer that breaks the pair fails loudly instead of
-- silently desynchronising the public catalog.

ALTER TABLE quiz_exams.exams ADD COLUMN IF NOT EXISTS languages TEXT[];

-- Backfill before NOT NULL. Re-runnable: after the first pass no row is NULL.
UPDATE quiz_exams.exams SET languages = ARRAY[language] WHERE languages IS NULL;

ALTER TABLE quiz_exams.exams ALTER COLUMN languages SET DEFAULT '{vi}';
ALTER TABLE quiz_exams.exams ALTER COLUMN languages SET NOT NULL;

-- ADD CONSTRAINT has no IF NOT EXISTS; the migration must stay re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_languages_chk') THEN
    ALTER TABLE quiz_exams.exams
      -- COALESCE, not a bare array_length: array_length('{}', 1) is NULL, and a
      -- CHECK only rejects FALSE — so `array_length(...) >= 1` lets the empty
      -- array straight through (and `language = languages[1]` is NULL too, so
      -- it does not catch it either). Same reason for the explicit NULL-element
      -- test: '{NULL}' has length 1 and compares as NULL against `language`.
      ADD CONSTRAINT exams_languages_chk CHECK (
        COALESCE(array_length(languages, 1), 0) >= 1
        AND array_position(languages, NULL) IS NULL
        AND languages <@ ARRAY['vi', 'en', 'ja']::TEXT[]
        AND language = languages[1]
      );
  END IF;
END $$;

COMMENT ON COLUMN quiz_exams.exams.languages IS
  'All languages the exam is offered in; languages[1] is the primary and must equal language (public SEO URL).';

-- The in-app catalog filters client-side today, but /api/exams/exams?lang= is
-- the obvious next step and the public tag/list queries already scan this table
-- by language; a GIN index keeps `= ANY(languages)` from degrading to a seq
-- scan once the exam count grows.
CREATE INDEX IF NOT EXISTS idx_exams_languages_gin
  ON quiz_exams.exams USING GIN (languages);
