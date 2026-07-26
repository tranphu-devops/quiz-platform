-- Non-admin roles get email-only notifications.
--
-- Pushover/Telegram need a per-recipient user-key / chat-id, which only the
-- ops-facing admin screens have a reason to configure. Students/teachers who
-- ticked those boxes without entering a key produced queue rows that could
-- never be delivered (worker.js: "no <channel> target configured"), burning
-- through max_attempts into 'dead'. The server now only accepts 'email' for
-- non-admins (channelsForRole in notification-service); this cleans up rows
-- written before that rule existed.
--
-- Role comes from quiz_users.profiles.role — the same source of truth the ban
-- check and API-key auth use, not the (possibly stale) JWT claim.
-- All statements are plain UPDATEs guarded by WHERE, so re-running is a no-op.

-- 1. Turn off non-email subscriptions on user-audience events for non-admins.
--    Admin-audience rows are untouched: an admin's system alerts still use all
--    three channels, and only admins can hold those rows anyway.
UPDATE quiz_notifications.notification_subscriptions s
   SET enabled = false
  FROM quiz_notifications.event_types e, quiz_users.profiles p
 WHERE s.event_type = e.key
   AND e.audience = 'user'
   AND s.user_id = p.id
   AND p.role <> 'admin'
   AND s.channel <> 'email'
   AND s.enabled;

-- 2. Drop channel targets for non-admins. email_override goes too: their
--    notifications must land on the account email (worker.js falls back to
--    auth.users.email when the override is NULL), and there is no longer any
--    UI for them to change it.
UPDATE quiz_notifications.user_channel_targets t
   SET email_override    = NULL,
       pushover_user_key = NULL,
       telegram_chat_id  = NULL,
       updated_at        = NOW()
  FROM quiz_users.profiles p
 WHERE t.user_id = p.id
   AND p.role <> 'admin'
   AND (t.email_override IS NOT NULL
     OR t.pushover_user_key IS NOT NULL
     OR t.telegram_chat_id IS NOT NULL);

-- 3. Retire queued non-email sends already fanned out to non-admins. Left
--    alone they would each retry 5 times before dying anyway — this just
--    keeps the admin log viewer readable.
UPDATE quiz_notifications.notification_queue q
   SET status     = 'dead',
       last_error = 'channel disabled: non-admin recipients are email-only'
  FROM quiz_users.profiles p
 WHERE q.recipient_user_id = p.id
   AND p.role <> 'admin'
   AND q.channel <> 'email'
   AND q.status IN ('pending', 'processing');
