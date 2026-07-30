import { publicGetOr404, clientIpOf } from '$lib/server/examsApi'
import { publicT } from '$lib/i18n/public'
import { catalogUrl, canonical, collectionJsonLd, metaDescription } from '$lib/seo'

export async function load(event) {
  const { params, url, setHeaders } = event
  const { lang } = params
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1

  const data = await publicGetOr404(
    `/public/exams?lang=${encodeURIComponent(lang)}&page=${page}`,
    { clientIp: clientIpOf(event) }
  )

  setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=300' })

  const t = publicT(lang)
  const path = catalogUrl(lang)
  const title = page > 1
    ? `${t('catalog.title')} — ${t('pager.page', { n: page })} | NovaQuiz`
    : `${t('catalog.title')} | NovaQuiz`
  const description = metaDescription(t('catalog.metaDescription'), t('catalog.title'))

  return {
    ...data,
    seo: {
      title,
      description,
      // Self-canonical per page. Pointing page 2+ at page 1 would tell Google
      // the deeper pages are duplicates and stop it following through to the
      // exams only listed there.
      canonical: canonical(page > 1 ? `${path}?page=${page}` : path),
      jsonLd: collectionJsonLd({
        lang,
        name: t('catalog.title'),
        description,
        path,
        items: data.items,
        crumbs: [
          { name: t('nav.home'), path: `/${lang}` },
          { name: t('nav.exams'), path }
        ]
      })
    }
  }
}
