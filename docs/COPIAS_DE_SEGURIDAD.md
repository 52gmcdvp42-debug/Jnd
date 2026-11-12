# Copias de seguridad y recuperación

## Qué se protege y cómo

| Dato | Dónde vive | Protección |
|---|---|---|
| Usuarios, compras, membresías, estructura de cursos, progreso, cuestionarios, certificados, ajustes y páginas legales | PostgreSQL | `scripts/backup.sh` diario (cifrado AES-256) + copias automáticas/PITR del proveedor |
| Materiales (PDF…) y portadas | Bucket S3/R2 (`jnd-files`) | Versionado del bucket + replicación/sincronización a `jnd-backups` (ver abajo) |
| Vídeos | Bunny Stream / Mux | Conserva tus archivos originales fuera del proveedor (disco externo o bucket de archivo). La BD guarda qué vídeo usa cada lección |
| Pagos y facturas | Stripe | Stripe es la fuente de verdad; la BD guarda pedidos y suscripciones |
| Código | Repositorio Git | Historial completo |

## Copia automática diaria

El workflow `.github/workflows/backup.yml` se ejecuta cada día a las 03:17 UTC y sube a R2 una copia **cifrada**
de la base de datos. Configura en GitHub → Settings → Secrets:

`DATABASE_URL`, `BACKUP_PASSPHRASE`, `BACKUP_S3_URI` (p. ej. `s3://jnd-backups/db`),
`BACKUP_S3_ENDPOINT` (`https://<id>.r2.cloudflarestorage.com`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

**Guarda la `BACKUP_PASSPHRASE` en un gestor de contraseñas**: sin ella las copias no se pueden descifrar.

Recomendado en R2: regla de ciclo de vida (p. ej. 90 días) y *bucket lock* para que nadie pueda borrar copias recientes.

### Archivos del bucket

Activa el versionado de objetos en `jnd-files` o sincroniza periódicamente:

```bash
rclone sync r2:jnd-files r2:jnd-backups/files
```

## Copia manual

```bash
DATABASE_URL=… BACKUP_PASSPHRASE=… npm run backup
```

## Procedimiento de recuperación

1. **No toques la base de datos dañada.** Crea una base de datos nueva y vacía.
2. Descarga la última copia válida (`jnd-db-AAAAMMDD-HHMMSS.dump.enc`) y comprueba su suma:
   `sha256sum -c jnd-AAAAMMDD-HHMMSS.sha256`
3. Restaura en la base nueva:
   ```bash
   DATABASE_URL=<nueva> BACKUP_PASSPHRASE=… bash scripts/restore.sh jnd-db-….dump.enc --yes
   ```
   (Si usas almacenamiento local, añade también el archivo `jnd-files-….tar.gz.enc`.)
4. Comprueba con la web apuntando a la base nueva (en local o en un entorno de pruebas): inicia sesión
   como administrador y revisa alumnos, compras y cursos.
5. Cambia `DATABASE_URL` de producción a la base restaurada y reinicia la aplicación.
6. **Reconciliar con Stripe** los pagos posteriores a la copia: en Stripe → Developers → Webhooks,
   reenvía los eventos desde la hora de la copia. Son idempotentes: los ya procesados se ignoran.
7. Comprueba `/api/health` y el Resumen del panel.

Si el proveedor de BD ofrece **PITR** (recuperación a un instante), úsalo primero: pierde menos datos que la copia diaria.

## Prueba de restauración

Haz una restauración de prueba al menos una vez al trimestre en una base de datos aparte.
El procedimiento se probó durante el desarrollo: copia cifrada → restauración en una base nueva con los
mismos recuentos de usuarios, cursos, lecciones, pedidos, progreso, certificados y archivos idénticos.
