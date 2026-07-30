import { sequence } from '@sveltejs/kit/hooks'
import { redirect } from '@sveltejs/kit'
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit'
import * as Sentry from '@sentry/sveltekit'
import { SITE_ORIGIN } from '$lib/seo'

Sentry.init({
  dsn: 'https://e7ebd0288ccdf0549338a567dd6272e7@o4511670908878848.ingest.us.sentry.io/4511670913859584',
  // Only report from production builds (skip local `vite dev`)
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1
})

// Paths that belong to novaquiz.net, even though the same app also answers on
// app.novaquiz.net.
const PUBLIC_PATH = /^\/(?:vi|en|ja)(?:\/exams(?:\/|$)|\/?$)|^\/sitemap-exams\.xml$/

// The app's default link-preview tags, kept in app.html rather than a
// <svelte:head> because every app route is ssr:false — see the comment there.
const DEFAULT_META = `<meta name="description" content="NovaQuiz — nền tảng thi trực tuyến thông minh: tạo đề thi, quản lý bộ đề, chấm điểm tự động." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="NovaQuiz" />
    <meta property="og:title" content="NovaQuiz — Nền tảng thi trực tuyến thông minh" />
    <meta property="og:description" content="Tạo đề thi, quản lý bộ đề, trao huy hiệu và theo dõi kết quả học tập — tất cả trên một nền tảng đơn giản, mạnh mẽ, bảo mật." />
    <meta property="og:image" content="https://app.novaquiz.net/banner-og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://app.novaquiz.net/banner-og.png" />`

const publicSeo = async ({ event, resolve }) => {
  const host = event.request.headers.get('host') ?? ''
  const isPublic = PUBLIC_PATH.test(event.url.pathname)

  // One canonical home for the indexable pages. The app's robots.txt already
  // disallows everything, but a disallowed URL can still be indexed URL-only
  // when something links to it — a 301 removes the ambiguity. Scoped to the
  // `app.` host so localhost and the default_server vhost keep working.
  if (isPublic && host.startsWith('app.')) {
    redirect(301, `${SITE_ORIGIN}${event.url.pathname}${event.url.search}`)
  }

  // <html lang> per request. 'vi' is the previous hardcoded value, so nothing
  // changes for the app; the public pages get the language of their URL prefix.
  const lang = isPublic ? event.url.pathname.split('/')[1] : 'vi'
  const safeLang = /^(vi|en|ja)$/.test(lang) ? lang : 'vi'

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('%nq.lang%', safeLang)
        .replace('%nq.defaultmeta%', isPublic ? '' : DEFAULT_META)
  })
}

export const handleError = handleErrorWithSentry()
export const handle = sequence(sentryHandle(), publicSeo)
