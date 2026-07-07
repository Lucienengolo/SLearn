#!/usr/bin/env bash
set -euo pipefail

# Restore a Supabase Postgres database from a backup created by
# db-backup.sh. DESTRUCTIVE — drops and recreates objects in the target
# database. Requires typed confirmation unless -y/--yes is passed.
#
# Usage: DATABASE_URL=postgres://... ./scripts/db-restore.sh <backup-file> [-y]

BACKUP_FILE="${1:-}"
YES=0
for arg in "$@"; do
  if [ "$arg" = "-y" ] || [ "$arg" = "--yes" ]; then YES=1; fi
done

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: DATABASE_URL=postgres://... $0 <backup-file> [-y]" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set." >&2
  exit 1
fi

if [ "$YES" -ne 1 ]; then
  echo "This will DROP and recreate objects in the target database:"
  echo "  $DATABASE_URL"
  echo "from backup: $BACKUP_FILE"
  read -r -p "Type 'restore' to continue: " CONFIRM
  if [ "$CONFIRM" != "restore" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring $BACKUP_FILE into target database ..."
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$BACKUP_FILE"
echo "Restore complete."
