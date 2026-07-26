import { sendEmail } from '../lib/channels/email.js'
import { renderEmailHtml, renderEmailText } from '../lib/emailLayout.js'
import { formatDateTime } from '../lib/brand.js'

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

    // Same branded shell as every queued notification email — emailLayout
    // escapes all interpolated values itself.
    const content = {
      preheader: `New contact message from ${name.trim()}`,
      eyebrow: 'Contact form',
      heading: 'New message from the contact form',
      intro: 'Someone submitted the contact form on novaquiz.net.',
      blocks: [
        { type: 'facts', facts: [['Name', name.trim()], ['Email', email.trim()], ['Received at', formatDateTime(new Date())]] },
        { type: 'quote', label: 'Message', text: message.trim() }
      ],
      cta: { label: `Reply to ${name.trim()}`, url: `mailto:${email.trim()}` },
      footerReason: 'You received this email because you are the configured contact inbox for NovaQuiz.'
    }

    try {
      await sendEmail({
        to,
        subject: `[NovaQuiz Contact] ${name.trim()}`,
        html: renderEmailHtml(content),
        text: renderEmailText(content)
      })
      return { success: true }
    } catch (err) {
      req.log.error(err)
      return reply.status(502).send({ error: 'Gửi liên hệ thất bại, vui lòng thử lại sau', statusCode: 502 })
    }
  })
}
