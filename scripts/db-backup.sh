#!/usr/bin/env bash
set -euo pipefail

# Back up the Supabase Postgres database to a timestamped custom-format
# dump. Requires DATABASE_URL — the project's connection string (Supabase
# dashboard: Settings > Database > Connection string > URI). Never commit
# the resulting .dump file; backups/ is gitignored.
#
# Usage: DATABASE_URL=postgres://... ./scripts/db-backup.sh [output-dir]

OUTPUT_DIR="${1:-backups}"
mkdir -p "$OUTPUT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set." >&2
  echo "  export DATABASE_URL='postgres://postgres:[password]@[host]:5432/postgres'" >&2
  exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUTPUT_FILE="$OUTPUT_DIR/slearn-$TIMESTAMP.dump"

echo "Backing up to $OUTPUT_FILE ..."
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUTPUT_FILE"

echo "Done: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"
