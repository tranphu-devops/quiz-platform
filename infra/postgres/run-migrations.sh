#!/bin/sh
# Idempotent SQL migration runner (POSIX sh + psql).
#
# Applies every infra/postgres/migrations/*.sql file exactly once, in filename
# order, tracking applied files in public.schema_migrations. Runs automatically
# as the one-shot `migrate` service in docker-compose before the app services
# start, so schema changes need zero manual psql. To add a migration, drop a new
# NNNN_name.sql file into migrations/ — that's it.
#
# Each file runs in a single transaction (--single-transaction + ON_ERROR_STOP),
# so a failing migration rolls back and is not recorded. Because every migration
# is written idempotently (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / ON CONFLICT),
# re-running against a database that was migrated manually before is safe.
set -e

: "${PGHOST:=postgres}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=quizdb}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

psql() { command psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 "$@"; }

echo "[migrate] waiting for postgres at $PGHOST..."
until command psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -c 'SELECT 1' >/dev/null 2>&1; do
  sleep 1
done

echo "[migrate] ensuring schema_migrations table"
psql -q -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"

applied=0
skipped=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$f" ] || { echo "[migrate] no migration files found in $MIGRATIONS_DIR"; break; }
  name=$(basename "$f")
  exists=$(psql -tAc "SELECT 1 FROM public.schema_migrations WHERE filename = '$name'")
  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "[migrate] applying $name ..."
  psql -q --single-transaction -f "$f"
  psql -q -c "INSERT INTO public.schema_migrations (filename) VALUES ('$name');"
  applied=$((applied + 1))
done

echo "[migrate] done — $applied applied, $skipped already up to date."
