// Fire-and-forget call into notification-service's internal enqueue
// endpoint. Never throws into the caller — a notification failure must not
// affect the business operation that triggered it (same philosophy as
// awardBadgesIfEarned's .catch(() => {}) fire-and-forget calls elsewhere).
//
// `event` is the base key without an audience suffix, e.g.
// 'submission.completed'. `recipients` names specific people beyond the
// automatic admin fan-out, e.g. [{ role: 'owner', user_id }, { role: 'teacher', user_id }].
export function notify(event, { recipients = [], payload = {} } = {}) {
  if (!process.env.NOTIFICATION_SERVICE_URL) return
  fetch(`${process.env.NOTIFICATION_SERVICE_URL}/internal/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
    body: JSON.stringify({ event, recipients, payload })
  }).catch(() => {})
}
