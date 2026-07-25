import { sendEmail } from '../lib/channels/email.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 200) {
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
