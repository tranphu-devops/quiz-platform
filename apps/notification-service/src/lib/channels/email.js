// Plain fetch to Resend's REST API — no SDK, matching generator-service's
// lib/llm.js precedent of calling OpenRouter directly instead of pulling in
// a provider SDK for one endpoint.
const RESEND_URL = 'https://api.resend.com/emails'

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_EMAIL_FROM
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  if (!from) throw new Error('NOTIFICATION_EMAIL_FROM not configured')
  if (!to) throw new Error('missing recipient email')

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html: `<p>${html}</p>` })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`)
  }
}
