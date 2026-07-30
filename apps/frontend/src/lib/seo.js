// Canonical URLs, meta and JSON-LD for the public pages.
//
// SITE_ORIGIN is a constant, never event.url.origin: the same SvelteKit app is
// reachable at both novaquiz.net and app.novaquiz.net, so deriving it from the
// request would emit a canonical pointing at the wrong host — the exact
// duplicate-content problem these pages have to avoid.
export const SITE_ORIGIN = 'https://novaquiz.net'
export const APP_ORIGIN = 'https://app.novaquiz.net'

// Reuses the @ids minted by scripts/build-landing-i18n.js so the landing pages
// and these pages describe one entity graph rather than two unrelated ones.
const ORG_ID = `${SITE_ORIGIN}/#organization`
const WEBSITE_ID = `${SITE_ORIGIN}/#website`

export const canonical = (path) => `${SITE_ORIGIN}${path}`

export const examUrl = (lang, slug) => `/${lang}/exams/${slug}`
export const topicUrl = (lang, slug) => `/${lang}/exams/topics/${slug}`
export const catalogUrl = (lang) => `/${lang}/exams`

/**
 * Deep link into the app for the "start exam" CTA. Still the UUID route: the
 * app is disallow-all for crawlers, so a slug there would buy nothing, and the
 * app page itself sends an anonymous visitor to /login?next=<this path>.
 */
export const takeExamUrl = (id) => `${APP_ORIGIN}/exams/${id}`

/** Trim to a meta-description length on a word boundary. */
export function metaDescription(text, fallback, maxLen = 155) {
  const src = (text ?? '').trim() || fallback
  if (src.length <= maxLen) return src
  const cut = src.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * hreflang alternates. With one language there is nothing to relate, and a
 * self-only set is noise, so this returns [] until a second language ships.
 */
export function buildHreflang(langs, pathFor) {
  if (!langs || langs.length < 2) return []
  return [
    ...langs.map((l) => ({ hreflang: l, href: canonical(pathFor(l)) })),
    { hreflang: 'x-default', href: canonical(pathFor(langs[0])) }
  ]
}

function breadcrumb(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: canonical(it.path)
    }))
  }
}

const graph = (nodes) => ({ '@context': 'https://schema.org', '@graph': nodes })

/** JSON-LD for the catalog and topic-hub pages. */
export function collectionJsonLd({ lang, name, description, path, items, crumbs, about }) {
  return graph([
    {
      '@type': 'CollectionPage',
      '@id': canonical(path),
      url: canonical(path),
      name,
      description,
      inLanguage: lang,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      ...(about ? { about: { '@type': 'Thing', name: about } } : {})
    },
    {
      '@type': 'ItemList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: canonical(examUrl(lang, it.slug)),
        name: it.title
      }))
    },
    breadcrumb(crumbs)
  ])
}

/**
 * JSON-LD for an exam page.
 *
 * LearningResource, not Quiz. Google's practice-problems rich result needs
 * Quiz.hasPart.Question.acceptedAnswer — which would publish in the page source
 * exactly the answer key these endpoints strip out, and would describe content
 * the page does not show, which is a structured-data mismatch. Revisit only if
 * the product decides to publish answers.
 */
export function examJsonLd({ lang, exam, path, crumbs }) {
  return graph([
    {
      '@type': 'LearningResource',
      '@id': canonical(path),
      url: canonical(path),
      name: exam.title,
      description: metaDescription(exam.description_text, exam.title, 300),
      inLanguage: exam.language ?? lang,
      learningResourceType: 'Quiz',
      educationalUse: 'assessment',
      ...(exam.time_limit ? { timeRequired: `PT${exam.time_limit}M` } : {}),
      isAccessibleForFree: true,
      author: { '@type': 'Person', name: exam.creator_name },
      publisher: { '@id': ORG_ID },
      isPartOf: { '@id': WEBSITE_ID },
      ...(exam.created_at ? { datePublished: exam.created_at } : {}),
      ...(exam.updated_at ? { dateModified: exam.updated_at } : {}),
      ...(exam.tags?.length ? { keywords: exam.tags.map((t) => t.label).join(', ') } : {}),
      ...(exam.question_count ? { numberOfItems: exam.question_count } : {})
    },
    breadcrumb(crumbs)
  ])
}

/**
 * Serialise JSON-LD for inline embedding. `<` is escaped so a title containing
 * "</script>" cannot break out of the script element — the same precaution
 * scripts/build-landing-i18n.js takes.
 */
export const jsonLdText = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c')
