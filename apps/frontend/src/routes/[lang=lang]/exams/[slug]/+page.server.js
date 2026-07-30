import { publicGetOr404, clientIpOf } from '$lib/server/examsApi'
import { publicT } from '$lib/i18n/public'
import { examUrl, catalogUrl, topicUrl, canonical, examJsonLd, metaDescription } from '$lib/seo'

export async function load(event) {
  const { params, setHeaders } = event
  const { lang, slug } = params

  const exam = await publicGetOr404(
    `/public/exams/${encodeURIComponent(slug)}`,
    { clientIp: clientIpOf(event) }
  )

  setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=600' })

  const t = publicT(lang)
  const path = examUrl(lang, slug)
  const primaryTag = exam.tags?.[0] ?? null
  const title = exam.question_count
    ? `${exam.title} — ${t('exam.questions', { count: exam.question_count })} | NovaQuiz`
    : `${exam.title} | NovaQuiz`
  const description = metaDescription(exam.description_text, t('exam.metaFallback'))

  return {
    exam,
    lang,
    seo: {
      title,
      description,
      canonical: canonical(path),
      ogType: 'article',
      ogImage: exam.cover_image_url || undefined,
      jsonLd: examJsonLd({
        lang,
        exam,
        path,
        crumbs: [
          { name: t('nav.home'), path: `/${lang}` },
          { name: t('nav.exams'), path: catalogUrl(lang) },
          ...(primaryTag ? [{ name: primaryTag.label, path: topicUrl(lang, primaryTag.slug) }] : []),
          { name: exam.title, path }
        ]
      })
    }
  }
}
