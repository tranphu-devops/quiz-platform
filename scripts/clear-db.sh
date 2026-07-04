#!/usr/bin/env bash
# Clear all user-generated data, keeping admin accounts + all admin_settings.
# Usage:
#   ./scripts/clear-db.sh                         # connects via Docker (docker compose exec)
#   PGHOST=... PGUSER=... ./scripts/clear-db.sh   # connects via env vars (remote/local psql)
set -euo pipefail

USE_DOCKER=true
if [[ -n "${PGHOST:-}" ]]; then
  USE_DOCKER=false
fi

run_psql() {
  if $USE_DOCKER; then
    docker compose exec -T postgres psql \
      -U "${PGUSER:-postgres}" -d "${PGDB:-quizdb}" "$@"
  else
    PGPASSWORD="${PGPASSWORD:-}" psql \
      -h "$PGHOST" -p "${PGPORT:-5432}" \
      -U "${PGUSER:-postgres}" -d "${PGDB:-quizdb}" "$@"
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CLEAR DATABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ADMIN_INFO=$(run_psql -tAc "
  SELECT u.email
  FROM   auth.users u
  JOIN   quiz_users.profiles p ON p.id = u.id
  WHERE  p.role = 'admin';
" 2>/dev/null || echo "(không kết nối được)")

echo "GIỮ LẠI:"
echo "  • admin_settings (toàn bộ)"
if [[ -z "$ADMIN_INFO" ]]; then
  echo "  ⚠️  Không tìm thấy tài khoản admin nào"
else
  while IFS= read -r line; do
    echo "  • admin: $line"
  done <<< "$ADMIN_INFO"
fi

echo ""
echo "XÓA SẠCH:"
echo "  • auth.users + identities + sessions (non-admin)"
echo "  • quiz_users.profiles (non-admin)"
echo "  • quiz_exams.exams, questions, collections, collection_exams"
echo "  • quiz_submissions.submissions, student_badges"
echo "  • quiz_interactions.comments, likes, reports"
echo ""
read -r -p "Tiếp tục? (yes/N) " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Hủy."
  exit 0
fi

echo ""
echo "Đang xóa..."

run_psql <<'SQL'
DO $$
DECLARE
  admin_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO admin_ids
  FROM quiz_users.profiles
  WHERE role = 'admin';

  -- interactions
  DELETE FROM quiz_interactions.reports;
  DELETE FROM quiz_interactions.likes;
  DELETE FROM quiz_interactions.comments;

  -- submissions
  DELETE FROM quiz_submissions.student_badges;
  DELETE FROM quiz_submissions.submissions;

  -- exams (questions cascade via ON DELETE CASCADE)
  DELETE FROM quiz_exams.collection_exams;
  DELETE FROM quiz_exams.collections;
  DELETE FROM quiz_exams.exams;

  -- profiles: non-admin only
  IF admin_ids IS NOT NULL THEN
    DELETE FROM quiz_users.profiles WHERE id <> ALL(admin_ids);
  ELSE
    DELETE FROM quiz_users.profiles;
  END IF;

  -- admin_settings: KHÔNG XÓA — giữ nguyên toàn bộ settings

  -- auth.users: non-admin (identities/sessions/refresh_tokens cascade)
  IF admin_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id <> ALL(admin_ids);
  ELSE
    DELETE FROM auth.users;
  END IF;

  RAISE NOTICE 'Xong. Admin giữ lại: %', COALESCE(admin_ids::TEXT, '(không có)');
END;
$$;
SQL

echo ""
echo "✅ Hoàn tất."
