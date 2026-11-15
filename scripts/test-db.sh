#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres cluster (with a stub of
# Supabase's auth schema) and runs the SQL test files in supabase/tests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PG_TEST_PORT:-55432}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -M -s /bin/false pgtest
  chown pgtest "$WORK"
  RUN_AS=(runuser -u pgtest --)
fi

cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

status=0
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "test     $(basename "$f")"
  if "${PSQL[@]}" -f "$f" >"$WORK/out" 2>&1; then rc=0; else rc=$?; status=1; fi
  sed -n 's/^.*NOTICE:  /  /p;/ERROR/p' "$WORK/out"
  [ "$rc" = 0 ] || echo "  FAILED: $(basename "$f")"
done
exit $status
