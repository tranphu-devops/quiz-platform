// Fire-and-forget call into notification-service's internal enqueue
// endpoint. Never throws into the caller — a notification failure must not
// affect the generation job that triggered it.
export function notify(event, { recipients = [], payload = {} } = {}) {
  if (!process.env.NOTIFICATION_SERVICE_URL) return
  fetch(`${process.env.NOTIFICATION_SERVICE_URL}/internal/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
    body: JSON.stringify({ event, recipients, payload })
  }).catch(() => {})
}
