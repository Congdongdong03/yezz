#!/usr/bin/env sh
set -eu

backup_database_url="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$backup_database_url" ]; then
  echo "BACKUP_DATABASE_URL or DATABASE_URL is required" >&2
  exit 1
fi

backup_dir="$(mktemp -d)"
backup_file="$backup_dir/yezyy-backup.dump"
cleanup() {
  rm -f "$backup_file"
  rmdir "$backup_dir" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

pg_dump --format=custom --no-owner --no-privileges --file="$backup_file" "$backup_database_url"
test -s "$backup_file"
pg_restore --list "$backup_file" >/dev/null

echo "Database backup integrity check passed"
