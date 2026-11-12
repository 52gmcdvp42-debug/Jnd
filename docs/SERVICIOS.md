# Servicios externos

Ninguno de estos servicios está contratado ni conectado. La plataforma funciona en local
sin ellos (pagos desactivados, correos en consola, archivos en disco). Cada uno se activa
añadiendo sus claves al archivo `.env` del servidor.

| Servicio | Función en JND | Necesario para | Recomendado |
|---|---|---|---|
| **Alojamiento web** | Ejecutar la aplicación Next.js | Publicar la web | Vercel, Railway, Render o un VPS (Hetzner, DigitalOcean) |
| **PostgreSQL gestionado** | Usuarios, compras, cursos, progreso… | Publicar la web | Neon, Supabase, Railway (con copias automáticas / PITR) |
| **Stripe** | Cobros únicos, suscripciones, renovaciones, reembolsos | Vender | Stripe (comisión por transacción, sin cuota fija) |
| **Bunny Stream** | Alojar y emitir vídeos (HLS adaptativo, token) | Vídeos protegidos | Bunny Stream (pago por uso; económico para vídeos largos) · alternativa: Mux |
| **Cloudflare R2** (S3) | Materiales privados, portadas, copias de seguridad | Archivos en producción | R2 (sin coste de salida) · alternativa: AWS S3, Backblaze B2 |
| **Resend** | Emails de verificación, contraseña, compras | Correo real | Resend · alternativa: cualquier SMTP adaptando `src/lib/email.ts` |
| **Dominio** | jnd.xxx | Publicar la web | Cualquier registrador |

## Variables de entorno

Ver `.env.example`. Las más importantes:

- `APP_URL` — URL pública (https://…)
- `APP_SECRET` — `openssl rand -hex 32`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `BUNNY_STREAM_CDN_HOST`, `BUNNY_STREAM_TOKEN_KEY` (o `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`)
- `STORAGE_DRIVER=s3`, `S3_*`
- `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`

## Stripe: eventos del webhook

Endpoint: `https://TU-DOMINIO/api/webhooks/stripe`. Eventos a activar:

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
charge.refunded
```

Activa también el **Portal de cliente** en Stripe (Ajustes → Billing → Customer portal) para que los
alumnos gestionen su método de pago y facturas.

## Bunny Stream

1. Crea una *Video Library*. Anota el hostname del CDN (`vz-xxxx.b-cdn.net`).
2. En la Pull Zone de la librería, activa **Token Authentication** y copia la clave.
3. Opcional: limita los dominios permitidos (*Allowed referrers*) a tu dominio.
4. Sube vídeos en Bunny y pega su *Video ID* en el panel de JND (Vídeos o en la lección).

## Mux (alternativa)

Crea los assets con *playback policy* **signed**, genera una *Signing Key* y usa el *Playback ID*.
