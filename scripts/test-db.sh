#!/usr/bin/env bash
# Draait alle migraties + pgTAP-tests op een tijdelijke lokale PostgreSQL (zonder Docker).
# Vereist: PostgreSQL 15+ binaries en de pgTAP-extensie (bijv. apt install postgresql-16-pgtap).
# Met Docker + Supabase CLI kun je in plaats hiervan `npx supabase test db` gebruiken.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PATH="$PGBIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"

cleanup() { pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  echo "Draai dit script niet als root (PostgreSQL weigert dat)." >&2
  exit 1
fi

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database app"
"${PSQL[@]}" -d app -f "$ROOT/scripts/db-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d app -f "$f" >/dev/null
done

status=0
for t in "$ROOT"/supabase/tests/*.sql; do
  echo "# $(basename "$t")"
  out="$("${PSQL[@]}" -d app -X -A -t -f "$t" 2>&1)" || status=1
  echo "$out" | grep -vE '^(\{.*\}|)$' | grep -E '^(ok|not ok|#|1\.\.)|ERROR' || true
  if echo "$out" | grep -qE '^not ok|Looks like you failed|ERROR'; then status=1; fi
done

if [ $status -eq 0 ]; then echo "Alle databasetests geslaagd."; else echo "Er zijn databasetests mislukt." >&2; fi
exit $status
