#!/usr/bin/env bash
# Concatenates every migration into supabase/setup.sql, for pasting into the
# Supabase SQL Editor in one go on a brand-new project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/setup.sql"
{
  echo "-- The Two Six Club: complete database setup for a NEW Supabase project."
  echo "-- Generated from supabase/migrations by scripts/build-setup-sql.sh. Do not edit by hand."
  echo "-- Paste all of this into Supabase > SQL Editor > New query, then click Run."
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo; echo "-- ===================================================================="
    echo "-- $(basename "$f")"
    echo "-- ===================================================================="
    cat "$f"
  done
} > "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") lines)"
