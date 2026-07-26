-- Referral signups had no admin-audience event, unlike every other business
-- event in the catalog (0016_notifications.sql seeds a `.admin` row for each).
-- Without it, referral activity was invisible to platform ops — the enqueue
-- fan-out looks up `${event}.admin` subscriptions, which could never exist.
--
-- Also fills in the label_ja / description_vi columns skipped when
-- referral.completed.owner was added in 0017_referrals.sql, so the preferences
-- UI doesn't fall back to the event key for Japanese.
INSERT INTO quiz_notifications.event_types (key, audience, label_vi, label_en, label_ja, description_vi, applicable_roles) VALUES
  ('referral.completed.admin', 'admin',
   'Có người đăng ký qua link giới thiệu',
   'New referral signup',
   '紹介リンク経由の新規登録',
   'Gửi cho admin mỗi khi có người dùng mới đăng ký qua link giới thiệu của người khác',
   NULL)
ON CONFLICT (key) DO NOTHING;

UPDATE quiz_notifications.event_types
   SET label_ja       = COALESCE(label_ja, '紹介リンクから登録がありました'),
       description_vi = COALESCE(description_vi, 'Gửi cho bạn khi có người đăng ký NovaQuiz bằng link giới thiệu của bạn')
 WHERE key = 'referral.completed.owner';
