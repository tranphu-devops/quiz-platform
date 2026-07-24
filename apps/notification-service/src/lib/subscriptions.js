import { pool } from '../db.js'

export async function listEventTypes(audience, role) {
  const { rows } = await pool.query(
    `SELECT key, label_vi, label_en, label_ja, description_vi, applicable_roles
     FROM event_types
     WHERE audience = $1 AND (applicable_roles IS NULL OR $2 = ANY(applicable_roles))
     ORDER BY key`,
    [audience, role]
  )
  return rows
}

export async function getSubscriptions(userId) {
  const { rows } = await pool.query(
    `SELECT event_type, channel, enabled FROM notification_subscriptions WHERE user_id = $1`,
    [userId]
  )
  return rows
}

// entries: [{ event_type, channel, enabled }] — upserts each row; does not
// delete rows missing from the list, so callers should always submit the
// full set of (event_type, channel) pairs shown in the UI, not a diff.
export async function replaceSubscriptions(userId, entries) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const entry of entries) {
      if (!entry?.event_type || !entry?.channel) continue
      await client.query(
        `INSERT INTO notification_subscriptions (user_id, event_type, channel, enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, event_type, channel) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [userId, entry.event_type, entry.channel, !!entry.enabled]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getTargets(userId) {
  const { rows } = await pool.query(
    `SELECT email_override, pushover_user_key, telegram_chat_id FROM user_channel_targets WHERE user_id = $1`,
    [userId]
  )
  return rows[0] || { email_override: null, pushover_user_key: null, telegram_chat_id: null }
}

export async function upsertTargets(userId, targets) {
  const { email_override = null, pushover_user_key = null, telegram_chat_id = null } = targets ?? {}
  await pool.query(
    `INSERT INTO user_channel_targets (user_id, email_override, pushover_user_key, telegram_chat_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       email_override = EXCLUDED.email_override,
       pushover_user_key = EXCLUDED.pushover_user_key,
       telegram_chat_id = EXCLUDED.telegram_chat_id,
       updated_at = NOW()`,
    [userId, email_override || null, pushover_user_key || null, telegram_chat_id || null]
  )
}
