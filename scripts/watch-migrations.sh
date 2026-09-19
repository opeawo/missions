#!/usr/bin/env bash
# Prints NEW_MIGRATION <file> when a migration appears that is not yet applied.
# Applied set is tracked in .migrations-applied (gitignored via .env*? no - see below).
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
STATE=".migrations-applied"
touch "$STATE"

while true; do
  for f in supabase/migrations/*.sql; do
    [ -e "$f" ] || continue
    name=$(basename "$f")
    if ! grep -qxF "$name" "$STATE"; then
      echo "NEW_MIGRATION $name"
    fi
  done
  sleep 20
done
