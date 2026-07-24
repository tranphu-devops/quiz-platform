const PUSHOVER_URL = 'https://api.pushover.net/1/messages.json'

export async function sendPushover({ userKey, title, message, url }) {
  const token = process.env.PUSHOVER_APP_TOKEN
  if (!token) throw new Error('PUSHOVER_APP_TOKEN not configured')
  if (!userKey) throw new Error('missing Pushover user key')

  const body = new URLSearchParams({ token, user: userKey, title, message: message || title })
  if (url) body.set('url', url)

  const res = await fetch(PUSHOVER_URL, { method: 'POST', body })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pushover ${res.status}: ${text.slice(0, 300)}`)
  }
}
