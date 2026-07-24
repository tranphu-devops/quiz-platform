import { pool } from '../db.js'

// Resolves one business event into concrete notification_queue rows and
// inserts them all in one transaction — fan-out happens here, at enqueue
// time, not at dispatch time, so the worker never re-joins subscriptions.
//
// `event` is the base key without an audience suffix, e.g. 'submission.completed'.
// Admin fan-out always checks `${event}.admin` against every admin who
// subscribed. `recipients` names additional specific people, e.g.
// [{ role: 'owner', user_id }, { role: 'teacher', user_id }] — each is
// checked against `${event}.${role}` for that one user's own subscriptions.
export async function enqueue({ event, recipients = [], payload = {} }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const rows = []
    const adminKey = `${event}.admin`
    const adminSubs = await client.query(
      `SELECT user_id, channel FROM notification_subscriptions
       WHERE event_type = $1 AND enabled`,
      [adminKey]
    )
    for (const sub of adminSubs.rows) {
      rows.push({ event_type: adminKey, channel: sub.channel, recipient_user_id: sub.user_id })
    }

    for (const recipient of recipients) {
      if (!recipient?.user_id || !recipient?.role) continue
      const key = `${event}.${recipient.role}`
      const subs = await client.query(
        `SELECT channel FROM notification_subscriptions
         WHERE user_id = $1 AND event_type = $2 AND enabled`,
        [recipient.user_id, key]
      )
      for (const sub of subs.rows) {
        rows.push({ event_type: key, channel: sub.channel, recipient_user_id: recipient.user_id })
      }
    }

    for (const row of rows) {
      await client.query(
        `INSERT INTO notification_queue (event_type, channel, recipient_user_id, payload)
         VALUES ($1, $2, $3, $4)`,
        [row.event_type, row.channel, row.recipient_user_id, JSON.stringify(payload)]
      )
    }

    await client.query('COMMIT')
    return rows.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
