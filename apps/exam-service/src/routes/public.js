// Unauthenticated read API behind the public SEO pages at
// novaquiz.net/{lang}/exams/... — the only anonymous surface exam-service has.
//
// Registered as its own plugin rather than added to routes/exams.js: the auth
// preHandler there is scoped to that plugin's encapsulation context, so a
// sibling plugin is never subject to it. That is a stronger guarantee than a
// path-prefix early-return inside the hook, and it keeps the invariant in
// exams.js simple — everything that file owns requires a token, no exceptions.
//
// Authorization here is the WHERE clause: is_published = true AND deleted_at
// IS NULL. `req.ability` does not exist on these routes, so CASL must not be
// used. Nothing in a response may contain correct_answer or explanation.

import { pool } from '../db.js'
import { getOrSet } from '../lib/cache.js'
import { sanitizeDescription, descriptionToText, excerpt } from '../lib/sanitizeDescription.js'
import { publicQuestion } from '../lib/publicShape.js'

const LANGS = ['vi', 'en', 'ja']
const TAG_SLUG_RE = /^[a-z0-9-]{1,80}$/
const PAGE_SIZE = 24
const MAX_PAGE = 200

// Per-route limits are declared inline rather than inherited from the service
// default so they stay visible to static analysis (see the CodeQL rate-limit
// finding on shared preHandlers).
const READ_LIMIT = { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }
const SITEMAP_LIMIT = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }

// Slug + display label per tag, computed by the same SQL function the topic-hub
// lookup matches on.
const TAGS_JSON = `
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('label', t, 'slug', slugify(t)) ORDER BY t)
    FROM unnest(e.tags) t WHERE slugify(t) <> ''
  ), '[]'::jsonb) AS tags`

const CARD_SELECT = `
  SELECT e.slug, e.title, e.description, e.cover_image_url, e.time_limit,
         e.passing_score, e.language, e.created_at, e.updated_at, e.scheduled_at,
         COALESCE(p.full_name, 'NovaQuiz') AS creator_name,
         (SELECT COUNT(*)::int FROM questions q
           WHERE q.exam_id = e.id AND q.deleted_at IS NULL) AS question_count,
         (SELECT COUNT(*)::int FROM quiz_submissions.submissions s
           WHERE s.exam_id = e.id) AS submission_count,
         ${TAGS_JSON},
         COUNT(*) OVER()::int AS total
  FROM exams e
  LEFT JOIN quiz_users.profiles p ON p.id = e.created_by
  WHERE e.is_published = true AND e.deleted_at IS NULL AND e.language = $1`

function toCard(row) {
  const { description, total, ...rest } = row
  return { ...rest, excerpt: excerpt(description, 200) }
}

function parsePage(raw) {
  const n = Number.parseInt(raw ?? '1', 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_PAGE)
}

/** Tag cloud for a language: slug, the most common accented spelling, count. */
async function tagsAvailable(lang) {
  const { rows } = await pool.query(
    `SELECT slugify(t) AS slug,
            mode() WITHIN GROUP (ORDER BY t) AS label,
            COUNT(*)::int AS count
     FROM exams e CROSS JOIN LATERAL unnest(e.tags) t
     WHERE e.is_published = true AND e.deleted_at IS NULL AND e.language = $1
       AND slugify(t) <> ''
     GROUP BY 1
     ORDER BY count DESC, slug
     LIMIT 40`,
    [lang]
  )
  return rows
}

export default async function publicRoutes(fastify) {
  // GET /public/exams?lang=vi&tag=<tag-slug>&page=1 — catalog
  fastify.get('/public/exams', READ_LIMIT, async (req, reply) => {
    const lang = req.query.lang ?? 'vi'
    const tag = req.query.tag ?? null
    const page = parsePage(req.query.page)

    if (!LANGS.includes(lang)) {
      return reply.status(400).send({ error: 'Unsupported language', statusCode: 400 })
    }
    if (tag !== null && !TAG_SLUG_RE.test(tag)) {
      return reply.status(400).send({ error: 'Invalid tag', statusCode: 400 })
    }

    try {
      return await getOrSet(`public:list:${lang}:${tag ?? '_'}:${page}`, 300, async () => {
        const params = [lang]
        let where = ''
        if (tag) {
          params.push(tag)
          where = ` AND EXISTS (SELECT 1 FROM unnest(e.tags) t WHERE slugify(t) = $${params.length})`
        }
        params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE)

        const { rows } = await pool.query(
          `${CARD_SELECT}${where}
           ORDER BY e.created_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params
        )

        return {
          items: rows.map(toCard),
          page,
          page_size: PAGE_SIZE,
          total: rows[0]?.total ?? 0,
          tags_available: await tagsAvailable(lang)
        }
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /public/topics/:tagSlug?lang=vi&page=1 — topic hub
  fastify.get('/public/topics/:tagSlug', READ_LIMIT, async (req, reply) => {
    const lang = req.query.lang ?? 'vi'
    const { tagSlug } = req.params
    const page = parsePage(req.query.page)

    if (!LANGS.includes(lang)) {
      return reply.status(400).send({ error: 'Unsupported language', statusCode: 400 })
    }
    if (!TAG_SLUG_RE.test(tagSlug)) {
      return reply.status(400).send({ error: 'Invalid tag', statusCode: 400 })
    }

    try {
      const data = await getOrSet(`public:topic:${lang}:${tagSlug}:${page}`, 300, async () => {
        // mode() picks a canonical display label: tags are free text, so
        // 'Lịch sử' and 'lịch sử' both slugify to lich-su and the hub needs one
        // deterministic spelling for its <h1> and <title>.
        const topicResult = await pool.query(
          `SELECT mode() WITHIN GROUP (ORDER BY t) AS label, COUNT(*)::int AS exam_count
           FROM exams e CROSS JOIN LATERAL unnest(e.tags) t
           WHERE e.is_published = true AND e.deleted_at IS NULL AND e.language = $1
             AND slugify(t) = $2`,
          [lang, tagSlug]
        )
        const topic = topicResult.rows[0]
        if (!topic || topic.exam_count === 0) return null

        const { rows } = await pool.query(
          `${CARD_SELECT}
             AND EXISTS (SELECT 1 FROM unnest(e.tags) t WHERE slugify(t) = $2)
           ORDER BY e.created_at DESC
           LIMIT $3 OFFSET $4`,
          [lang, tagSlug, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        )

        return {
          topic: { slug: tagSlug, label: topic.label, exam_count: topic.exam_count },
          items: rows.map(toCard),
          page,
          page_size: PAGE_SIZE,
          total: rows[0]?.total ?? 0,
          tags_available: await tagsAvailable(lang)
        }
      })

      // An empty hub must 404, never render. A page listing nothing is the
      // thin content this whole feature exists to avoid.
      if (!data) return reply.status(404).send({ error: 'Topic not found', statusCode: 404 })
      return data
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /public/exams/:slug — exam detail
  fastify.get('/public/exams/:slug', READ_LIMIT, async (req, reply) => {
    const { slug } = req.params
    if (!TAG_SLUG_RE.test(slug)) {
      return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
    }

    try {
      const data = await getOrSet(`public:exam:${slug}`, 600, async () => {
        const examResult = await pool.query(
          // e.tags is aliased: TAGS_JSON also emits a column called `tags`, and
          // the driver would keep only the last one.
          `SELECT e.id, e.slug, e.title, e.description, e.cover_image_url, e.time_limit,
                  e.passing_score, e.language, e.credit_cost, e.tags AS tag_labels,
                  e.created_at, e.updated_at, e.scheduled_at,
                  COALESCE(p.full_name, 'NovaQuiz') AS creator_name,
                  p.avatar_url AS creator_avatar,
                  ${TAGS_JSON},
                  (SELECT COUNT(*)::int FROM questions q
                    WHERE q.exam_id = e.id AND q.deleted_at IS NULL) AS question_count,
                  (SELECT COUNT(*)::int FROM quiz_submissions.submissions s
                    WHERE s.exam_id = e.id) AS submission_count,
                  (SELECT COUNT(*)::int FROM quiz_interactions.likes li
                    WHERE li.exam_id = e.id) AS like_count,
                  (SELECT COUNT(*)::int FROM quiz_interactions.comments co
                    WHERE co.exam_id = e.id) AS comment_count
           FROM exams e
           LEFT JOIN quiz_users.profiles p ON p.id = e.created_by
           WHERE e.slug = $1 AND e.is_published = true AND e.deleted_at IS NULL`,
          [slug]
        )
        if (examResult.rows.length === 0) return null
        const { tag_labels: tagLabels, description, ...exam } = examResult.rows[0]

        // The opening question, deterministically. The app's student preview
        // uses ORDER BY RANDOM(), which is wrong here: the sample question is
        // the bulk of this page's unique content, and it must not change
        // between crawls.
        const sampleResult = await pool.query(
          `SELECT * FROM questions
           WHERE exam_id = $1 AND deleted_at IS NULL
           ORDER BY order_index, id LIMIT 1`,
          [exam.id]
        )

        const related = await pool.query(
          `SELECT e2.slug, e2.title, e2.cover_image_url,
                  (SELECT COUNT(*)::int FROM questions q
                    WHERE q.exam_id = e2.id AND q.deleted_at IS NULL) AS question_count
           FROM exams e2
           WHERE e2.id <> $1 AND e2.is_published = true AND e2.deleted_at IS NULL
             AND e2.language = $2 AND e2.tags && $3::text[]
           ORDER BY cardinality(ARRAY(
                      SELECT unnest(e2.tags) INTERSECT SELECT unnest($3::text[])
                    )) DESC, e2.created_at DESC
           LIMIT 6`,
          [exam.id, exam.language, tagLabels ?? []]
        )

        const clean = sanitizeDescription(description)
        return {
          ...exam,
          description: clean,
          description_text: descriptionToText(clean),
          sample_question: sampleResult.rows[0] ? publicQuestion(sampleResult.rows[0]) : null,
          related: related.rows
        }
      })

      if (!data) return reply.status(404).send({ error: 'Exam not found', statusCode: 404 })
      return data
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })

  // GET /public/sitemap — feed for the frontend's /sitemap-exams.xml
  fastify.get('/public/sitemap', SITEMAP_LIMIT, async (req, reply) => {
    try {
      return await getOrSet('public:sitemap', 900, async () => {
        const exams = await pool.query(
          `SELECT slug, language, updated_at
           FROM exams
           WHERE is_published = true AND deleted_at IS NULL
           ORDER BY updated_at DESC NULLS LAST`
        )
        // HAVING COUNT(*) >= 2 keeps single-exam hubs out of the index: with one
        // member a hub is a near-duplicate of the exam page it links to.
        const topics = await pool.query(
          `SELECT slugify(t) AS slug, e.language,
                  COUNT(*)::int AS exam_count,
                  MAX(e.updated_at) AS updated_at
           FROM exams e CROSS JOIN LATERAL unnest(e.tags) t
           WHERE e.is_published = true AND e.deleted_at IS NULL AND slugify(t) <> ''
           GROUP BY 1, 2
           HAVING COUNT(*) >= 2
           ORDER BY exam_count DESC, slug`
        )
        return {
          exams: exams.rows,
          topics: topics.rows,
          generated_at: new Date().toISOString()
        }
      })
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Internal server error', statusCode: 500 })
    }
  })
}
