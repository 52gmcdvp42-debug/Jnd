# Despliegue en producción

> No se ha desplegado nada. Estos son los pasos cuando decidas publicar.

1. **Base de datos**: crea un PostgreSQL 16 gestionado con copias automáticas. Copia la URL de conexión.
2. **Almacenamiento**: crea dos buckets R2: `jnd-files` (privado; portadas servidas con un dominio público
   o `S3_PUBLIC_BASE_URL`) y `jnd-backups` (privado, con *Object Lock* / retención si es posible).
3. **Vídeo**: configura Bunny Stream como en `docs/SERVICIOS.md`.
4. **Aplicación**: despliega el repositorio en tu proveedor con las variables de entorno de `.env.example`.
   - Build: `npm run build` · Inicio: `npm start`
   - Antes de cada versión: `npx prisma migrate deploy`
5. **Datos iniciales**: `npm run db:seed` y `npm run create-admin -- --email … --name …`
6. **Stripe**: crea el webhook (ver `docs/SERVICIOS.md`) y prueba primero en **modo test** con la tarjeta 4242 4242 4242 4242.
7. **Correo**: verifica tu dominio en Resend y define `EMAIL_FROM`.
8. **Legal**: completa las páginas legales en Admin → Ajustes y que las revise un profesional.
9. **Copias**: configura los secretos del workflow `Backup diario` (ver `docs/COPIAS_DE_SEGURIDAD.md`) y haz una restauración de prueba.
10. **Comprobación final**: `/api/health` responde `{"ok":true}`; el Resumen del panel muestra todos los servicios en verde.

## Lista de comprobación antes de abrir al público

- [ ] `APP_SECRET` aleatorio y `APP_URL` con https
- [ ] Stripe en modo live, webhook con todos los eventos y portal de cliente activo
- [ ] Token Authentication activo en Bunny
- [ ] Páginas legales completadas y revisadas
- [ ] Copia de seguridad diaria funcionando y restauración probada
- [ ] Al menos un curso publicado con precio o incluido en una membresía activa
