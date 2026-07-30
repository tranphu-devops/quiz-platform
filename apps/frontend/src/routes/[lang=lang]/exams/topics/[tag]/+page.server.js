import { publicGetOr404, clientIpOf } from '$lib/server/examsApi'
import { publicT } from '$lib/i18n/public'
import { topicUrl, catalogUrl, canonical, collectionJsonLd, metaDescription } from '$lib/seo'

export async function load(event) {
  const { params, url, setHeaders } = event
  const { lang, tag } = params
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1

  // exam-service 404s a topic with no published exams, which publicGetOr404
  // turns into a real 404 page — an empty hub must never render.
  const data = await publicGetOr404(
    `/public/topics/${encodeURIComponent(tag)}?lang=${encodeURIComponent(lang)}&page=${page}`,
    { clientIp: clientIpOf(event) }
  )

  setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=300' })

  const t = publicT(lang)
  const path = topicUrl(lang, tag)
  const label = data.topic.label
  const heading = t('topic.heading', { label })
  const title = page > 1
    ? `${heading} — ${t('pager.page', { n: page })} | NovaQuiz`
    : `${heading} — ${t('topic.count', { count: data.topic.exam_count })} | NovaQuiz`
  const description = metaDescription(
    t('topic.metaDescription', { count: data.topic.exam_count, label }),
    heading
  )

  return {
    ...data,
    seo: {
      title,
      description,
      canonical: canonical(page > 1 ? `${path}?page=${page}` : path),
      jsonLd: collectionJsonLd({
        lang,
        name: heading,
        description,
        path,
        items: data.items,
        about: label,
        crumbs: [
          { name: t('nav.home'), path: `/${lang}` },
          { name: t('nav.exams'), path: catalogUrl(lang) },
          { name: label, path }
        ]
      })
    }
  }
}
