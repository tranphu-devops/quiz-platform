import { error } from '@sveltejs/kit'
import { publicGet } from '$lib/server/examsApi'
import { canonical, catalogUrl, examUrl, topicUrl, PUBLIC_LANGS } from '$lib/seo'

// Served from the frontend rather than landing/: /sitemap.xml is an exact-match
// nginx location on the static landing root and stays the hand-maintained list
// of the 5 landing URLs. This path matches no location, so it falls through the
// catch-all to SvelteKit — no nginx change needed. Both are advertised from
// landing/robots.txt, which may list several Sitemap: lines.

// Whatever /{lang}/exams actually serves — listing a URL the router 404s is
// the fastest way to lose trust in a sitemap.
const LANGS = PUBLIC_LANGS

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const day = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : undefined)

function urlEntry({ path, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${esc(canonical(path))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

export async function GET({ request, setHeaders }) {
  // Belt and braces: the publicSeo hook already 301s this path off the app
  // host, so this only fires if that pattern is ever narrowed.
  if ((request.headers.get('host') ?? '').startsWith('app.')) {
    error(404, 'Not found')
  }

  const data = await publicGet('/public/sitemap')
  if (!data) error(503, 'Sitemap unavailable')

  const entries = []

  for (const lang of LANGS) {
    entries.push(urlEntry({ path: catalogUrl(lang), changefreq: 'daily', priority: '0.9' }))
  }

  for (const topic of data.topics) {
    if (!LANGS.includes(topic.language)) continue
    entries.push(urlEntry({
      path: topicUrl(topic.language, topic.slug),
      lastmod: day(topic.updated_at),
      changefreq: 'weekly',
      priority: '0.8'
    }))
  }

  for (const exam of data.exams) {
    if (!LANGS.includes(exam.language)) continue
    entries.push(urlEntry({
      path: examUrl(exam.language, exam.slug),
      lastmod: day(exam.updated_at),
      changefreq: 'monthly',
      priority: '0.7'
    }))
  }

  setHeaders({
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'public, max-age=900'
  })

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
  )
}
