#!/bin/bash
# Backup diário do banco BarberFlow — mantém últimos 7 dias
set -euo pipefail

BACKUP_DIR="/root/backups/barberflow"
DATE=$(date +%Y-%m-%d_%H%M)
FILE="$BACKUP_DIR/barberflow_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec barberflow_supabase-db-1 \
  pg_dump -U postgres -n barber --no-owner --no-privileges postgres \
  | gzip > "$FILE"

echo "[$(date)] Backup OK: $FILE ($(du -sh "$FILE" | cut -f1))"

# Rotação: remove backups com mais de 7 dias
find "$BACKUP_DIR" -name "barberflow_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Rotação aplicada — $(ls "$BACKUP_DIR" | wc -l) backup(s) mantidos"
