#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/certifica-ces"
BACKUP_DIR="/var/backups/certifica-ces"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

install -d -m 750 "$BACKUP_DIR"
sqlite3 "$APP_DIR/data/sistema_cursos.db" ".backup '$BACKUP_DIR/banco_$STAMP.db'"
tar -C "$APP_DIR" -czf "$BACKUP_DIR/qrcodes_$STAMP.tar.gz" qrcodes
find "$BACKUP_DIR" -type f -mtime +14 -delete

echo "Backup concluído em $BACKUP_DIR ($STAMP)"
