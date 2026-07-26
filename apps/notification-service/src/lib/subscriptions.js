import { pool } from '../db.js'

export const ALL_CHANNELS = ['pushover', 'email', 'telegram']

// Pushover/Telegram need a per-recipient user-key / chat-id, which only makes
// sense for the ops-facing admin screens — every other role is reachable at
// their account email, which worker.js resolves on its own. Keeping the list
// role-derived (instead of a UI constant) means the server, not the client,
// decides what may be stored.
export function channelsForRole(role) {
  return role === 'admin' ? ALL_CHANNELS : ['email']
}

// Channels whose destination the recipient has to supply by hand. Email isn't
// one: worker.js falls back to auth.users.email. So a caller limited to email
// has nothing to store in user_channel_targets.
const TARGET_CHANNELS = ['pushover', 'telegram']
export function needsChannelTargets(channels) {
  return channels.some((c) => TARGET_CHANNELS.includes(c))
}

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

// replaceSubscriptions() only upserts, so narrowing the channel list can't
// clear rows the UI no longer submits — a leftover enabled pushover/telegram
// row would keep fanning out and dead-lettering for lack of a target.
export async function disableChannelsExcept(userId, allowed) {
  await pool.query(
    `UPDATE notification_subscriptions SET enabled = false
     WHERE user_id = $1 AND enabled AND NOT (channel = ANY($2))`,
    [userId, allowed]
  )
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
