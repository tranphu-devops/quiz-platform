// Brand constants + formatting helpers shared by the email layout and the
// event templates. Kept separate from emailLayout.js so events.js can build
// links/labels without pulling in the whole HTML renderer.

// App URL (where a logged-in user lands) vs. the public marketing site. In
// production these are different hosts — app.novaquiz.net vs novaquiz.net —
// so a "go to your dashboard" link and a "what is NovaQuiz" link can't share
// one base. SITE_URL is the app; BRAND_SITE_URL overrides the marketing site.
const APP_URL = (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '').replace(/\/+$/, '')
const SITE_URL = (process.env.BRAND_SITE_URL || 'https://novaquiz.net').replace(/\/+$/, '')

// Recipients are Vietnam-based; an ISO timestamp in an email is unreadable.
const TIMEZONE = process.env.NOTIFICATION_TIMEZONE || 'Asia/Ho_Chi_Minh'

export const BRAND = {
  name: 'NovaQuiz',
  tagline: 'Smart online exam platform',
  // Header avatar. Must be an absolute URL on the *marketing* host: it is
  // served by Nginx from `landing/brand-assets/` (novaquiz.net), not by the
  // app. PNG, not the .svg next to it — Gmail and Outlook don't render SVG in
  // mail. Images are blocked by default in most clients, so the wordmark
  // beside it stays real text and the header still reads without this.
  logoUrl: `${SITE_URL}/brand-assets/icon-128.png`,
  blurb: 'NovaQuiz is an online exam platform for creating, sharing and taking quizzes — with AI-assisted exam generation, collections, badges and detailed result analytics.',
  appUrl: APP_URL,
  siteUrl: SITE_URL,
  supportEmail: process.env.CONTACT_EMAIL_TO || process.env.NOTIFICATION_EMAIL_FROM || '',
  // Light-mode-only palette: mirrors DESIGN.md's brand gradient. Email
  // clients strip most CSS, so every colour here is applied inline.
  primary: '#5625d1',
  accent: '#6d29d3',
  text: '#2b2a3f',
  muted: '#6b6b80',
  border: '#e2e0f0',
  surface: '#ffffff',
  bg: '#f4f3fb'
}

// Absolute link into the app. Returns undefined when SITE_URL isn't
// configured, so callers can drop the CTA instead of emitting a dead href.
export function appUrl(path = '/') {
  if (!APP_URL) return undefined
  return `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function siteUrl(path = '/') {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function examUrl(examId) {
  return examId ? appUrl(`/exams/${examId}`) : undefined
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// e.g. "26 Jul 2026, 16:05 GMT+7". Falls back to the raw value for anything
// unparseable rather than rendering "Invalid Date".
// A missing timestamp returns '' (the fact row is then dropped) rather than
// defaulting to now — queue rows are retried minutes later, so "now" at
// render time is not when the event happened. Callers that really mean now
// pass `new Date()`.
export function formatDateTime(value) {
  if (value == null || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'shortOffset'
  }).format(date)
}

// Referral/report emails name a third party to the recipient, who may not
// already know that person's address — show enough to recognise, not enough
// to contact: "phu.tran@gmail.com" -> "ph•••@gmail.com".
export function maskEmail(email) {
  const raw = String(email ?? '').trim()
  const at = raw.indexOf('@')
  if (at < 1) return ''
  const local = raw.slice(0, at)
  const domain = raw.slice(at)
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${'•'.repeat(3)}${domain}`
}

export function percent(value) {
  return value == null || value === '' ? '' : `${Math.round(Number(value) * 100) / 100}%`
}

// "20 credits" / "1 credit" — amounts show up in most credit-related events.
export function credits(amount) {
  if (amount == null || amount === '') return ''
  const n = Number(amount)
  if (Number.isNaN(n)) return String(amount)
  return `${n} ${Math.abs(n) === 1 ? 'credit' : 'credits'}`
}
