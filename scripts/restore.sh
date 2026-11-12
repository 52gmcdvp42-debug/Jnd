#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Restauración de JND desde una copia de seguridad.
#   bash scripts/restore.sh <archivo .dump o .dump.enc> [archivo files .tar.gz(.enc)] --yes
#
# ATENCIÓN: sustituye el contenido de la base de datos de DATABASE_URL.
# Restaura primero en una base de datos NUEVA/vacía y comprueba antes de apuntar la web a ella.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB_FILE="${1:?Uso: restore.sh <copia.dump[.enc]> [archivos.tar.gz[.enc]] --yes}"
FILES_ARCHIVE=""
CONFIRM=""
for a in "${@:2}"; do
  if [ "$a" = "--yes" ]; then CONFIRM=1; else FILES_ARCHIVE="$a"; fi
done
: "${DATABASE_URL:?Falta DATABASE_URL (base de datos destino)}"
PG_URL="${DATABASE_URL%%\?*}"
HOST_DB="$(echo "$PG_URL" | sed -E 's#^[a-z]+://([^:@]+(:[^@]*)?@)?##')"

if [ -z "$CONFIRM" ]; then
  echo "Se va a restaurar en: $HOST_DB"
  echo "Esto SUSTITUIRÁ los datos actuales. Vuelve a ejecutar añadiendo --yes para confirmar."
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

decrypt() {
  local src="$1" out="$2"
  if [[ "$src" == *.enc ]]; then
    : "${BACKUP_PASSPHRASE:?La copia está cifrada: define BACKUP_PASSPHRASE}"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$src" -out "$out" -pass env:BACKUP_PASSPHRASE
  else
    cp "$src" "$out"
  fi
}

echo "→ Preparando copia…"
decrypt "$DB_FILE" "$TMP/db.dump"
pg_restore --list "$TMP/db.dump" > /dev/null

echo "→ Restaurando base de datos en $HOST_DB…"
pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname="$PG_URL" "$TMP/db.dump"

if [ -n "$FILES_ARCHIVE" ]; then
  STORAGE="${STORAGE_LOCAL_DIR:-./storage}"
  echo "→ Restaurando archivos en $STORAGE…"
  decrypt "$FILES_ARCHIVE" "$TMP/files.tar.gz"
  mkdir -p "$STORAGE"
  tar -xzf "$TMP/files.tar.gz" -C "$STORAGE"
fi

echo "→ Aplicando migraciones pendientes (si la copia es de una versión anterior)…"
npx prisma migrate deploy

echo "✓ Restauración completada. Comprueba /api/health y accede al panel."
