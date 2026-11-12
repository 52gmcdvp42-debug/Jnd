#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Copia de seguridad de JND
#   - Base de datos completa (usuarios, compras, membresías, cursos, progreso,
#     certificados, ajustes…) con pg_dump en formato personalizado.
#   - Archivos subidos (materiales y portadas) si se usa almacenamiento local.
#   - Cifrado opcional (AES-256) y subida opcional a un bucket S3/R2.
#
# Variables:
#   DATABASE_URL         (obligatoria)
#   BACKUP_DIR           carpeta local (por defecto ./backups)
#   BACKUP_PASSPHRASE    si existe, cifra la copia (guárdala en lugar seguro)
#   BACKUP_S3_URI        p. ej. s3://jnd-backups/db  (requiere aws cli)
#   BACKUP_S3_ENDPOINT   endpoint S3 compatible (R2: https://<cuenta>.r2.cloudflarestorage.com)
#   BACKUP_KEEP_DAYS     días a conservar en local (por defecto 14)
#   STORAGE_LOCAL_DIR    carpeta de archivos locales (por defecto ./storage)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
DB_FILE="$BACKUP_DIR/jnd-db-$STAMP.dump"

# pg_dump no acepta parámetros de Prisma como ?schema=public
PG_URL="${DATABASE_URL%%\?*}"

echo "→ Volcando base de datos…"
pg_dump --format=custom --no-owner --no-privileges --file="$DB_FILE" "$PG_URL"
pg_restore --list "$DB_FILE" > /dev/null   # verifica que la copia es legible
FILES=("$DB_FILE")

STORAGE="${STORAGE_LOCAL_DIR:-./storage}"
if [ "${STORAGE_DRIVER:-local}" = "local" ] && [ -d "$STORAGE" ]; then
  echo "→ Empaquetando archivos locales…"
  FILES_TAR="$BACKUP_DIR/jnd-files-$STAMP.tar.gz"
  tar -czf "$FILES_TAR" -C "$STORAGE" .
  FILES+=("$FILES_TAR")
fi

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  echo "→ Cifrando…"
  for f in "${FILES[@]}"; do
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$f" -out "$f.enc" -pass env:BACKUP_PASSPHRASE
    rm -f "$f"
  done
  FILES=("${FILES[@]/%/.enc}")
fi

( cd "$BACKUP_DIR" && sha256sum $(for f in "${FILES[@]}"; do basename "$f"; done) > "jnd-$STAMP.sha256" )
FILES+=("$BACKUP_DIR/jnd-$STAMP.sha256")

if [ -n "${BACKUP_S3_URI:-}" ]; then
  echo "→ Subiendo a $BACKUP_S3_URI…"
  for f in "${FILES[@]}"; do
    aws s3 cp "$f" "$BACKUP_S3_URI/$(basename "$f")" ${BACKUP_S3_ENDPOINT:+--endpoint-url "$BACKUP_S3_ENDPOINT"} --only-show-errors
  done
fi

find "$BACKUP_DIR" -name 'jnd-*' -type f -mtime +"$KEEP" -delete
echo "✓ Copia completada:"
printf '   %s\n' "${FILES[@]}"
