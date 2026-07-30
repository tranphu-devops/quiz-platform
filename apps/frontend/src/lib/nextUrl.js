// Where to send someone after they sign in.
//
// Needed because the public pages on novaquiz.net link into the app: a visitor
// who clicks "Vào thi" on an exam page and then signs up used to land on
// /dashboard, having lost the exam they came for.
//
// The destination is stashed in localStorage rather than passed through the auth
// round-trip. GoTrue validates redirect targets against GOTRUE_URI_ALLOW_LIST,
// whose `/*` globs do not match a URL whose query string contains slashes, so
// `?next=/exams/<id>` on emailRedirectTo would be silently rejected and fall
// back to SITE_URL. Same approach as the referral code in +layout.svelte.

const KEY = 'quiz_next'

/**
 * Only same-site absolute paths. Rejects `//evil.com` and `https://evil.com`,
 * which would otherwise turn the login page into an open redirector.
 */
export function safeNext(raw) {
  if (!raw || typeof raw !== 'string') return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

/** Remember where to go after auth. No-op for an unsafe or missing path. */
export function rememberNext(raw) {
  const next = safeNext(raw)
  try {
    if (next) localStorage.setItem(KEY, next)
    else localStorage.removeItem(KEY)
  } catch {}
}

/** Read and clear the remembered destination, falling back to the dashboard. */
export function takeNext(fallback = '/dashboard') {
  try {
    const stored = safeNext(localStorage.getItem(KEY))
    localStorage.removeItem(KEY)
    return stored ?? fallback
  } catch {
    return fallback
  }
}
