/**
 * PLANTILLAS legales de partida. Los campos entre [CORCHETES] deben completarse y
 * TODO el texto debe revisarlo un profesional jurídico antes de publicar la web.
 * Se editan desde Admin → Ajustes → Páginas legales.
 */
export const LEGAL_SLUGS = ["aviso-legal", "privacidad", "cookies", "terminos"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_DEFAULTS: Record<LegalSlug, { title: string; body: string }> = {
  "aviso-legal": {
    title: "Aviso legal",
    body: `## Titular del sitio web
En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa:

- Titular: [RAZÓN SOCIAL O NOMBRE]
- NIF/CIF: [NIF]
- Domicilio: [DIRECCIÓN]
- Correo electrónico: [EMAIL DE CONTACTO]
- Datos registrales: [REGISTRO MERCANTIL, si aplica]

## Objeto
Este sitio web ofrece formación online en educación financiera. Los contenidos tienen finalidad exclusivamente educativa y no constituyen asesoramiento financiero, de inversión, fiscal ni legal personalizado.

## Propiedad intelectual
Todos los contenidos (vídeos, textos, materiales, marcas y diseño) son propiedad de [TITULAR] o se usan con autorización. Queda prohibida su reproducción, distribución o comunicación pública sin autorización expresa.

## Responsabilidad
Invertir conlleva riesgos, incluida la pérdida del capital. Las rentabilidades pasadas no garantizan rentabilidades futuras. Cada usuario es responsable de sus decisiones.

## Legislación aplicable
[COMPLETAR CON ASESORAMIENTO JURÍDICO]`,
  },
  privacidad: {
    title: "Política de privacidad",
    body: `## Responsable del tratamiento
[RAZÓN SOCIAL] · NIF [NIF] · [DIRECCIÓN] · [EMAIL DE CONTACTO]

## Datos que tratamos
- Datos de cuenta: nombre, correo electrónico y contraseña (almacenada cifrada mediante hash, nunca en claro).
- Datos de aprendizaje: progreso, resultados de cuestionarios y certificados.
- Datos de compra: productos adquiridos e importes. Los datos de tarjeta los gestiona directamente Stripe; JND no los almacena.

## Finalidades y base legal
- Prestar el servicio contratado (ejecución del contrato).
- Gestionar pagos y facturación (obligación legal y ejecución del contrato).
- Comunicaciones sobre tu cuenta (interés legítimo).

## Encargados del tratamiento
[LISTA DE PROVEEDORES: alojamiento, base de datos, Stripe, proveedor de vídeo, correo electrónico]

## Conservación
[PLAZOS DE CONSERVACIÓN]

## Tus derechos
Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [EMAIL]. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`,
  },
  cookies: {
    title: "Política de cookies",
    body: `## Cookies que utilizamos
JND utiliza únicamente cookies técnicas estrictamente necesarias para el funcionamiento de la plataforma:

- jnd_session: mantiene tu sesión iniciada de forma segura. Caduca a los 30 días o al cerrar sesión.

Estas cookies están exentas de consentimiento según el artículo 22.2 de la LSSI-CE.

## Servicios de terceros
Al reproducir vídeos o realizar un pago, los proveedores correspondientes (proveedor de vídeo, Stripe) pueden utilizar sus propias cookies técnicas. [REVISAR SEGÚN PROVEEDORES CONTRATADOS]

Si en el futuro se añaden cookies analíticas o publicitarias, se solicitará tu consentimiento previo.`,
  },
  terminos: {
    title: "Términos y condiciones de contratación",
    body: `## Objeto
Estas condiciones regulan la compra de cursos, módulos y membresías de JND.

## Productos
- Cursos y módulos: pago único, acceso [DURACIÓN DEL ACCESO, p. ej. ilimitado mientras la plataforma esté activa].
- Membresías mensuales y anuales: suscripción con renovación automática hasta su cancelación.

## Precios y pago
Los precios incluyen [IVA / impuestos aplicables]. El pago se procesa de forma segura a través de Stripe.

## Cancelación de membresías
Puedes cancelar tu membresía en cualquier momento desde tu área privada. Mantendrás el acceso hasta el final del periodo ya pagado.

## Derecho de desistimiento
[COMPLETAR: régimen de desistimiento para contenido digital (art. 103.m TRLGDCU) y consentimiento expreso del usuario]

## Reembolsos
[POLÍTICA DE REEMBOLSOS]

## Aviso de riesgo
El contenido es educativo y no constituye asesoramiento financiero. Invertir conlleva riesgo de pérdida.

## Contacto
[EMAIL DE CONTACTO]`,
  },
};
