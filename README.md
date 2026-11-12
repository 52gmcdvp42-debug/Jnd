# JND — Academia online

**THINK. LEARN. LEAD.** · *THE FUTURE STARTS HERE.*

Plataforma de formación online de JND: catálogo, venta de cursos y módulos sueltos,
membresías mensuales y anuales, vídeo protegido, materiales, cuestionarios, certificados
verificables, área del alumno y panel de administración completo.

## Estructura de contenidos

```
Academia → Categorías → Cursos → Módulos → Lecciones (vídeo · texto · cuestionario)
```

Cada curso, módulo y lección puede estar en **Borrador** (solo el equipo), **Publicado** u **Oculto**.
Un curso oculto no aparece en el catálogo, pero quien ya lo compró conserva el acceso.

## Tecnología

| Pieza | Elección | Motivo |
|---|---|---|
| Web + API | Next.js 15 (App Router) + TypeScript | Un solo proyecto para web, área privada, panel y API |
| Base de datos | PostgreSQL + Prisma | Fiable, relacional, migraciones versionadas |
| Autenticación | Propia: sesiones en BD, cookie `httpOnly`, Argon2id | Sin dependencias externas ni costes |
| Pagos | Stripe Checkout + webhooks firmados | Compras, suscripciones, renovaciones, cancelaciones y reembolsos |
| Vídeo | Bunny Stream (recomendado) o Mux, reproductor HLS propio | Calidad adaptativa, URLs firmadas temporales |
| Archivos | S3 compatible (Cloudflare R2 recomendado), disco local en desarrollo | Descargas mediante enlaces temporales |
| Correo | Resend (consola en desarrollo) | Verificación, recuperación de contraseña, confirmaciones |
| Estilos | Tailwind CSS con la paleta corporativa | Diseño coherente y adaptable |

## Puesta en marcha (desarrollo)

Requisitos: Node 22 y PostgreSQL 16.

```bash
npm install
cp .env.example .env          # y rellena DATABASE_URL y APP_SECRET
npx prisma migrate deploy
npm run db:seed               # 7 categorías + niveles Esencial y Completa (inactivos, sin precio)
npm run create-admin -- --email tu@email.com --name "Tu Nombre"
npm run dev                   # http://localhost:3000
```

El seed **no** crea cursos ni contenido: todo se crea desde el panel (`/admin`).

## Pruebas

```bash
npm test            # unitarias + webhooks de Stripe contra PostgreSQL (BD jnd_test)
npm run test:e2e    # flujos completos en navegador (BD desechable jnd_e2e)
npm run typecheck && npx next lint
```

## Documentación

- [Servicios externos y costes](docs/SERVICIOS.md)
- [Despliegue en producción](docs/DESPLIEGUE.md)
- [Copias de seguridad y recuperación](docs/COPIAS_DE_SEGURIDAD.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Guía del panel de administración](docs/GUIA_ADMIN.md)
