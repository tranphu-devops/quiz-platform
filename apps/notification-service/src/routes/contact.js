import { sendEmail } from '../lib/channels/email.js'

// ReDoS-safe email check. The single '@' is excluded from both character
// classes, so it acts as a hard separator with no ambiguity — the engine
// can't backtrack across it, keeping this linear-time (unlike the classic
// /[^\s@]+@[^\s@]+\.[^\s@]+/, where '.' also matches [^\s@] and creates
// polynomial backtracking, flagged by CodeQL). The required TLD dot is
// checked separately on the already-split domain. Caller must bound length
// before calling.
function isValidEmail(email) {
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  if (domain.length < 3 || !domain.includes('.')) return false
  return /^[^\s@]+@[^\s@]+$/.test(email)
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Public, unauthenticated endpoint behind landing/contact.html — no user
// session exists on the marketing site, so this can't reuse the
// subscription/queue plumbing built for logged-in recipients. It sends
// straight through the Resend channel adapter instead.
export default async function contactRoutes(fastify) {
  fastify.post('/contact', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { name, email, message } = req.body ?? {}

    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return reply.status(400).send({ error: 'Vui lòng nhập họ tên hợp lệ', statusCode: 400 })
    }
    if (typeof email !== 'string' || email.length > 200 || !isValidEmail(email)) {
      return reply.status(400).send({ error: 'Vui lòng nhập email hợp lệ', statusCode: 400 })
    }
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return reply.status(400).send({ error: 'Vui lòng nhập nội dung hợp lệ', statusCode: 400 })
    }

    const to = process.env.CONTACT_EMAIL_TO || process.env.NOTIFICATION_EMAIL_FROM
    if (!to) {
      return reply.status(503).send({ error: 'Contact form is not configured', statusCode: 503 })
    }

    // sendEmail() wraps this string in its own single <p>, so keep it to
    // inline tags + <br/> rather than nested block elements.
    const html = [
      `<strong>Từ:</strong> ${escapeHtml(name.trim())} (${escapeHtml(email.trim())})`,
      `<strong>Nội dung:</strong>`,
      escapeHtml(message.trim()).replace(/\n/g, '<br/>')
    ].join('<br/><br/>')

    try {
      await sendEmail({ to, subject: `[NovaQuiz Contact] ${name.trim()}`, html })
      return { success: true }
    } catch (err) {
      req.log.error(err)
      return reply.status(502).send({ error: 'Gửi liên hệ thất bại, vui lòng thử lại sau', statusCode: 502 })
    }
  })
}
