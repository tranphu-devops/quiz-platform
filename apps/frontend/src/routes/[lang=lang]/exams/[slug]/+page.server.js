import { redirect } from '@sveltejs/kit'
import { publicGetOr404, clientIpOf } from '$lib/server/examsApi'
import { publicT } from '$lib/i18n/public'
import {
  examUrl, catalogUrl, topicUrl, canonical, examJsonLd, metaDescription, landingHome, PUBLIC_LANGS
} from '$lib/seo'

export async function load(event) {
  const { params, setHeaders } = event
  const { lang, slug } = params

  const exam = await publicGetOr404(
    `/public/exams/${encodeURIComponent(slug)}`,
    { clientIp: clientIpOf(event) }
  )

  // The slug resolves without a language, so every enabled prefix would serve
  // the same exam at its own URL — the duplicate content the canonical tag is
  // there to prevent, and a page whose <html lang> lies about its content. An
  // exam has exactly one language (`language` = languages[1], migration 0024),
  // so the other prefixes redirect to the URL that owns it. An exam in a
  // language we do not publish has no such URL: send those to the catalog
  // instead of to a prefix that 404s.
  if (exam.language !== lang) {
    redirect(308, PUBLIC_LANGS.includes(exam.language) ? examUrl(exam.language, slug) : catalogUrl(lang))
  }

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
          { name: t('nav.home'), path: landingHome(lang) },
          { name: t('nav.exams'), path: catalogUrl(lang) },
          ...(primaryTag ? [{ name: primaryTag.label, path: topicUrl(lang, primaryTag.slug) }] : []),
          { name: exam.title, path }
        ]
      })
    }
  }
}
