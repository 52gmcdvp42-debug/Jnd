# Seguridad

## Autenticación y sesiones
- Contraseñas con **Argon2id** (parámetros OWASP). Mínimo 10 caracteres con letras y números.
- Sesiones en base de datos; la cookie (`httpOnly`, `SameSite=Lax`, `Secure` y prefijo `__Host-` en producción)
  contiene un token aleatorio de 256 bits y en la BD solo se guarda su hash SHA-256.
- Límites de intentos (PostgreSQL, válidos con varias instancias) en login, registro, recuperación,
  cuestionarios, descargas y reproducción.
- Cambiar la contraseña o el rol cierra las demás sesiones. Cuentas desactivables desde el panel.
- Tokens de verificación y recuperación de un solo uso, con caducidad, almacenados como hash.

## Roles
- **Alumno**: su área privada.
- **Editor**: gestión de contenidos (categorías, cursos, módulos, lecciones, vídeos, materiales, cuestionarios).
- **Administrador**: todo, incluidos alumnos, compras, reembolsos, membresías, certificados y ajustes.

## Control de acceso (siempre en el servidor)
Toda decisión de acceso pasa por `src/lib/access.ts` y se aplica en páginas, API de vídeo, descargas,
cuestionarios y certificados. El navegador no decide nada. El middleware solo es una primera barrera.

## Pagos
- El acceso se concede **solo** mediante el webhook de Stripe con firma verificada.
  Volver a la página de confirmación no concede nada (probado).
- Procesamiento idempotente (registro de eventos y comprobación de estado del pedido).
- Reembolso total = retirada automática del acceso.

## Vídeo y materiales
- URLs de vídeo firmadas y temporales (Bunny token / Mux JWT) entregadas solo a usuarios autorizados.
- Marca de agua dinámica con el email del alumno, sin descarga directa ni menú contextual.
- Materiales privados fuera de la web pública; descargas tras comprobar permisos, con enlace temporal de 60 s (S3).
- **Limitación conocida**: ninguna medida impide al 100 % grabar la pantalla. Las medidas anteriores
  dificultan compartir y permiten identificar el origen de una filtración.

## Cuestionarios
Las respuestas correctas nunca se envían al navegador: la corrección se hace en el servidor (probado).

## Cabeceras y otros
- Content-Security-Policy con *nonce*, `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Protección CSRF: acciones de servidor de Next.js (comprobación de origen) y comprobación de `Origin` en APIs POST.
- Redirecciones solo a rutas internas.
- Registro de actividad de acciones sensibles (Admin → Registro de actividad).
