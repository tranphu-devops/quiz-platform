import { pool } from '../db.js'
import { renderMessage } from './events.js'
import { sendPushover } from './channels/pushover.js'
import { sendEmail } from './channels/email.js'
import { sendTelegram } from './channels/telegram.js'

const BATCH_SIZE = 20
const BASE_BACKOFF_SECONDS = 30

// Polled by node-cron from index.js. Claims a batch of due rows under
// FOR UPDATE SKIP LOCKED (so a slow send never blocks another poll from
// claiming other rows), then dispatches each outside the claiming
// transaction — an HTTP call to Pushover/Resend/Telegram must never hold a
// DB lock open.
export async function tick() {
  const claimed = await claimBatch()
  if (claimed.length === 0) return
  console.log(`[notification] dispatching ${claimed.length} queued notification(s)`)
  for (const row of claimed) {
    await dispatchOne(row)
  }
}

async function claimBatch() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT * FROM notification_queue
       WHERE status = 'pending' AND available_at <= NOW()
       ORDER BY created_at
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE]
    )
    if (rows.length > 0) {
      await client.query(
        `UPDATE notification_queue SET status = 'processing' WHERE id = ANY($1::uuid[])`,
        [rows.map(r => r.id)]
      )
    }
    await client.query('COMMIT')
    return rows
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[notification] claim batch failed:', err.message)
    return []
  } finally {
    client.release()
  }
}

async function dispatchOne(row) {
  try {
    const target = await resolveTarget(row.recipient_user_id, row.channel)
    if (!target) throw new Error(`no ${row.channel} target configured for user ${row.recipient_user_id}`)

    const { title, body, url } = renderMessage(row.event_type, row.payload)

    if (row.channel === 'pushover') {
      await sendPushover({ userKey: target, title, message: body, url })
    } else if (row.channel === 'email') {
      await sendEmail({ to: target, subject: title, html: body })
    } else if (row.channel === 'telegram') {
      await sendTelegram({ chatId: target, text: `${title}\n\n${body}` })
    } else {
      throw new Error(`unknown channel ${row.channel}`)
    }

    await pool.query(
      `UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [row.id]
    )
  } catch (err) {
    await handleFailure(row, err)
  }
}

async function resolveTarget(userId, channel) {
  if (!userId) return null
  const { rows } = await pool.query(
    `SELECT email_override, pushover_user_key, telegram_chat_id
     FROM user_channel_targets WHERE user_id = $1`,
    [userId]
  )
  const target = rows[0]
  if (channel === 'pushover') return target?.pushover_user_key || null
  if (channel === 'telegram') return target?.telegram_chat_id || null
  if (channel === 'email') {
    if (target?.email_override) return target.email_override
    // Fall back to the account email — cross-schema read, same precedent as
    // interaction-service reading quiz_users.profiles directly.
    const auth = await pool.query('SELECT email FROM auth.users WHERE id = $1', [userId])
    return auth.rows[0]?.email || null
  }
  return null
}

async function handleFailure(row, err) {
  const attempts = row.attempts + 1
  const lastError = String(err.message || err).slice(0, 500)

  if (attempts >= row.max_attempts) {
    await pool.query(
      `UPDATE notification_queue SET status = 'dead', attempts = $1, last_error = $2 WHERE id = $3`,
      [attempts, lastError, row.id]
    )
    console.error(`[notification] gave up on ${row.id} (${row.event_type}/${row.channel}): ${lastError}`)
  } else {
    const backoffSeconds = BASE_BACKOFF_SECONDS * 2 ** (attempts - 1)
    await pool.query(
      `UPDATE notification_queue
       SET status = 'pending', attempts = $1, last_error = $2, available_at = NOW() + ($3 || ' seconds')::interval
       WHERE id = $4`,
      [attempts, lastError, backoffSeconds, row.id]
    )
  }
}
