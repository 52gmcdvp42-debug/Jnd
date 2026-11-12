import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import path from "node:path";

const db = new PrismaClient({ datasourceUrl: "postgresql://postgres:postgres@localhost:5432/jnd_e2e" });
const ADMIN = { email: "admin@e2e.local", password: "AdminE2E-Password1" };
const STUDENT = { email: "alumna@e2e.local", password: "Alumna-Segura-2026", name: "Laura Prueba" };

test.describe.configure({ mode: "serial" });
test.afterAll(() => db.$disconnect());

/** Falla si la página registra errores en consola (p. ej. bloqueos de CSP o errores de hidratación). */
function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Contraseña").fill(who.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/cuenta/);
}

async function logout(page: Page) {
  await page.context().clearCookies();
}

test("páginas públicas cargan sin errores (CSP + hidratación)", async ({ page }) => {
  const errors = watchConsole(page);
  for (const url of ["/", "/cursos", "/membresias", "/sobre-jnd", "/legal/privacidad", "/legal/terminos", "/certificados/verificar"]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(200);
  }
  await page.goto("/");
  await expect(page.getByText("THINK. LEARN. LEAD.").first()).toBeVisible();
  await expect(page.getByText("Bitcoin y criptomonedas").first()).toBeVisible();
  // Sin cursos publicados todavía: no se inventa contenido
  await expect(page.getByText("Próximamente")).toBeVisible();
  const headers = (await page.request.get("/")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(errors).toEqual([]);
});

test("rutas privadas protegidas", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fadmin/);
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/entrar/);
  // Cookie falsa: el middleware deja pasar pero el servidor valida contra la BD
  await page.context().addCookies([{ name: "jnd_session", value: "inventada", url: "http://localhost:3100" }]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/entrar/);
  // Webhook sin firma
  expect((await request.post("/api/webhooks/stripe", { data: "{}" })).status()).toBe(400);
});

test("el administrador crea un curso completo desde el panel", async ({ page }) => {
  const errors = watchConsole(page);
  await login(page, ADMIN);
  await page.goto("/admin/cursos");
  await page.getByLabel("Título").fill("Curso E2E de Bitcoin");
  await page.getByLabel("Categoría").selectOption({ label: "Bitcoin y criptomonedas" });
  await page.getByRole("button", { name: "Crear curso (borrador)" }).click();
  await page.waitForURL(/\/admin\/cursos\/c/);

  // Datos del curso, precio, certificado y publicación
  await page.getByLabel("Subtítulo").fill("Prueba automatizada");
  await page.getByLabel("Precio del curso completo (€)").fill("99,00");
  await page.getByLabel("Estado").first().selectOption("PUBLISHED");
  await page.getByLabel("Emitir certificado al completar el curso").check();
  await page.getByLabel("Progreso mínimo (%)").fill("100");
  await page.getByRole("button", { name: "Guardar curso" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  // Módulos
  await page.getByLabel("Nuevo módulo").fill("Fundamentos de Bitcoin");
  await page.getByRole("button", { name: "Añadir módulo" }).click();
  await expect(page.getByRole("link", { name: "Fundamentos de Bitcoin" })).toBeVisible();
  await page.getByLabel("Nuevo módulo").fill("Mentalidad inversora");
  await page.getByRole("button", { name: "Añadir módulo" }).click();
  await expect(page.getByRole("link", { name: "Mentalidad inversora" })).toBeVisible();

  // Módulo 1: precio suelto, publicar, lecciones
  await page.getByRole("link", { name: "Fundamentos de Bitcoin" }).click();
  await page.waitForURL(/\/admin\/modulos\//);
  await page.getByLabel("Precio del módulo suelto (€)").fill("29");
  await page.getByLabel("Estado").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Guardar módulo" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  for (const [title, type] of [["Qué es Bitcoin", "VIDEO"], ["Lectura introductoria", "TEXT"], ["Evaluación final", "QUIZ"]] as const) {
    await page.getByLabel("Nueva lección").fill(title);
    await page.getByLabel("Tipo").selectOption(type);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  }

  // Material PDF privado del módulo
  await page.getByPlaceholder("Ej.: Guía en PDF").fill("Guía PDF");
  await page.locator('input[type="file"][name="file"]').setInputFiles(path.join(__dirname, "fixtures/guia.pdf"));
  await page.getByRole("button", { name: "Añadir material" }).click();
  await expect(page.getByText("Material añadido.")).toBeVisible();

  // Lección de vídeo: publicar y enlazar vídeo (biblioteca)
  await page.getByRole("link", { name: "Qué es Bitcoin" }).click();
  await page.waitForURL(/\/admin\/lecciones\//);
  await expect(page.getByLabel("Título interno")).toBeVisible();
  await page.getByLabel("Título interno").fill("Vídeo intro");
  await page.getByLabel("Proveedor").selectOption("URL");
  await page.getByLabel("ID del vídeo / URL").fill("https://videos.example.com/intro.webm");
  await page.getByLabel("Duración (minutos)").fill("1");
  await page.getByRole("button", { name: "Añadir vídeo" }).click();
  await expect(page.getByText("Vídeo añadido a la biblioteca.")).toBeVisible();
  await page.reload();
  await page.getByLabel("Estado").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Guardar lección" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  // Lección de texto: vista previa gratuita
  await page.getByRole("link", { name: "Fundamentos de Bitcoin" }).click();
  await page.getByRole("link", { name: "Lectura introductoria" }).click();
  await expect(page.getByLabel("Texto / notas de la lección")).toBeVisible();
  await page.getByLabel("Texto / notas de la lección").fill("## Introducción\nBitcoin es una red monetaria abierta.\n\n- Escasez\n- Descentralización");
  await page.getByLabel("Estado").selectOption("PUBLISHED");
  await page.getByLabel("Vista previa gratuita").check();
  await page.getByRole("button", { name: "Guardar lección" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  // Cuestionario: evaluación con una pregunta
  await page.getByRole("link", { name: "Fundamentos de Bitcoin" }).click();
  await page.getByRole("link", { name: "Evaluación final" }).click();
  await expect(page.getByText("Las respuestas correctas se guardan")).toBeVisible();
  await page.getByLabel("Estado").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Guardar lección" }).click();
  await expect(page.getByText("Cambios guardados.").first()).toBeVisible();
  await page.getByLabel("Es una evaluación (cuenta para el certificado)").check();
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await page.getByLabel("Pregunta", { exact: true }).last().fill("¿Cuál es el suministro máximo de bitcoin?");
  const newQ = page.locator("form", { has: page.getByRole("button", { name: "Añadir pregunta" }) });
  await newQ.locator('input[name="opt_0"]').fill("21 millones");
  await newQ.locator('input[name="correct_0"]').check();
  await newQ.locator('input[name="opt_1"]').fill("Ilimitado");
  await newQ.getByRole("button", { name: "Añadir pregunta" }).click();
  await expect(page.getByText("Pregunta añadida.")).toBeVisible();

  // El vídeo de pruebas apunta al servidor local que simula el CDN
  await db.video.updateMany({ where: { title: "Vídeo intro" }, data: { providerVideoId: "http://localhost:4100/test.webm" } });
  expect(errors).toEqual([]);
});

test("el administrador configura una membresía", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin/membresias");
  await page.getByRole("link", { name: /Esencial/ }).click();
  await page.waitForURL(/\/admin\/membresias\/c/);
  await page.getByLabel("Precio mensual (€)").fill("19,90");
  await page.getByLabel("Precio anual (€)").fill("199");
  await page.getByLabel("Ventajas (una por línea)").fill("Acceso a Bitcoin\nNuevas lecciones cada mes");
  await page.getByLabel("Bitcoin y criptomonedas").check();
  await page.getByLabel("Membresía a la venta").check();
  await page.getByRole("button", { name: "Guardar membresía" }).click();
  await expect(page.getByText(/Membresía actualizada/)).toBeVisible();
  await page.goto("/membresias");
  await expect(page.getByText("19,90 €")).toBeVisible();
  await expect(page.getByText("Acceso a Bitcoin")).toBeVisible();
  await expect(page.getByText("Completa")).toHaveCount(0); // inactiva: no se muestra
});

test("alumno: registro, contenido bloqueado y vista previa gratuita", async ({ page, request }) => {
  const errors = watchConsole(page);
  await page.goto("/registro");
  await page.getByLabel("Nombre y apellidos").fill(STUDENT.name);
  await page.getByLabel("Email").fill(STUDENT.email);
  await page.getByLabel("Contraseña").fill("corta");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/registro/); // validación del navegador
  await page.getByLabel("Contraseña").fill("solamenteletras");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Incluye al menos un número")).toBeVisible(); // validación del servidor
  await page.getByLabel("Contraseña").fill(STUDENT.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL(/\/cuenta/);
  await expect(page.getByText("Todavía no tienes formaciones")).toBeVisible();

  await page.goto("/cursos");
  await page.getByRole("link", { name: /Curso E2E de Bitcoin/ }).click();
  await expect(page.getByText("99,00 €")).toBeVisible();
  await expect(page.getByRole("button", { name: /Comprar módulo · 29,00/ })).toBeVisible();
  await expect(page.getByText("Mentalidad inversora")).toHaveCount(0); // módulo en borrador: invisible

  // Pagos sin configurar: mensaje claro, sin acceso
  await page.getByRole("button", { name: "Comprar curso completo" }).click();
  await expect(page.getByText("Los pagos todavía no están activados")).toBeVisible();

  const lessons = await db.lesson.findMany({ include: { quiz: true } });
  const video = lessons.find((l) => l.type === "VIDEO")!;
  const text = lessons.find((l) => l.type === "TEXT")!;
  const res = await page.request.get(`/api/lessons/${video.id}/playback`);
  expect(res.status()).toBe(403);
  const resource = await db.resource.findFirstOrThrow();
  expect((await page.request.get(`/api/resources/${resource.id}/download`)).status()).toBe(403);
  expect((await request.get(`/api/resources/${resource.id}/download`)).status()).toBe(401);

  // Lección bloqueada → redirige a la ficha
  const slug = "curso-e2e-de-bitcoin";
  await page.goto(`/aprender/${slug}/${video.id}`);
  await expect(page).toHaveURL(new RegExp(`/cursos/${slug}`));
  // Vista previa gratuita accesible
  await page.goto(`/aprender/${slug}/${text.id}`);
  await expect(page.getByRole("heading", { name: "Introducción" })).toBeVisible();

  // El alumno no puede entrar al panel
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cuenta/);
  expect(errors).toEqual([]);
});

test("pago confirmado por webhook firmado → acceso automático al módulo", async ({ page, request }) => {
  const user = await db.user.findUniqueOrThrow({ where: { email: STUDENT.email } });
  const mod = await db.module.findFirstOrThrow({ where: { title: "Fundamentos de Bitcoin" } });
  const order = await db.order.create({ data: { userId: user.id, totalCents: 2900, currency: "eur", items: { create: { description: "Módulo", amountCents: 2900, moduleId: mod.id } } } });

  await login(page, STUDENT);
  await page.goto("/cuenta/compras?pago=procesando");
  await expect(page.getByText(/Estamos confirmando tu pago/)).toBeVisible();
  await page.goto("/cuenta");
  await expect(page.getByText("Todavía no tienes formaciones")).toBeVisible(); // volver de la página de pago NO da acceso

  const payload = JSON.stringify({ id: "evt_e2e_1", object: "event", type: "checkout.session.completed", data: { object: { mode: "payment", payment_status: "paid", metadata: { orderId: order.id }, payment_intent: "pi_e2e_1" } } });
  const bad = await request.post("/api/webhooks/stripe", { data: payload, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_otro" }), "content-type": "application/json" } });
  expect(bad.status()).toBe(400);
  const ok = await request.post("/api/webhooks/stripe", { data: payload, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_e2e" }), "content-type": "application/json" } });
  expect(ok.status()).toBe(200);

  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { name: "Curso E2E de Bitcoin" })).toBeVisible();
  await expect(page.getByText(/Módulos adquiridos: Fundamentos de Bitcoin/)).toBeVisible();
  await page.goto("/cuenta/compras");
  await expect(page.getByText("Pagado")).toBeVisible();
});

test("vídeo: reproduce, guarda progreso y reanuda donde se dejó", async ({ page }) => {
  const errors = watchConsole(page);
  await login(page, STUDENT);
  const video = await db.lesson.findFirstOrThrow({ where: { type: "VIDEO" } });
  await page.goto(`/aprender/curso-e2e-de-bitcoin/${video.id}`);
  const el = page.locator("video");
  await expect(el).toBeVisible();
  await expect(page.getByText(STUDENT.email)).toBeVisible(); // marca de agua
  await el.evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await new Promise((r) => (v.readyState >= 1 ? r(null) : v.addEventListener("loadedmetadata", r, { once: true })));
    v.currentTime = 23;
    await v.play();
    await new Promise((r) => setTimeout(r, 1500));
    v.pause();
  });
  await expect.poll(async () => (await db.lessonProgress.findFirst({ where: { lessonId: video.id } }))?.positionSeconds ?? 0).toBeGreaterThanOrEqual(23);

  // Recarga: debe reanudar en la posición guardada
  await page.reload();
  await expect.poll(() => el.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(23);
  await page.goto("/cuenta");
  await expect(page.getByText("Continuar donde lo dejaste")).toBeVisible();
  await expect(page.getByText(/Reanudar en 0:2\d/)).toBeVisible();

  const pb = await (await page.request.get(`/api/lessons/${video.id}/playback`)).json();
  expect(pb.start).toBeGreaterThanOrEqual(23);
  expect(errors).toEqual([]);
});

test("cuestionario: respuestas protegidas y corrección en servidor; certificado verificable", async ({ page }) => {
  await login(page, STUDENT);
  const quizLesson = await db.lesson.findFirstOrThrow({ where: { type: "QUIZ" }, include: { quiz: { include: { questions: { include: { options: true } } } } } });
  const correct = quizLesson.quiz!.questions[0].options.find((o) => o.isCorrect)!;
  const wrong = quizLesson.quiz!.questions[0].options.find((o) => !o.isCorrect)!;

  // Completar el resto de lecciones
  for (const l of await db.lesson.findMany({ where: { type: { not: "QUIZ" }, status: "PUBLISHED" } })) {
    await page.goto(`/aprender/curso-e2e-de-bitcoin/${l.id}`);
    const btn = page.getByRole("button", { name: "Marcar como completada" });
    if (await btn.isVisible()) {
      await btn.click();
      await expect(page.getByRole("button", { name: "✓ Completada" })).toBeVisible();
    }
  }

  const res = await page.goto(`/aprender/curso-e2e-de-bitcoin/${quizLesson.id}`);
  const html = (await res!.text()) + (await page.content());
  expect(html).not.toContain("isCorrect");
  expect(html).not.toContain("explanation");

  await page.getByLabel("Ilimitado").check();
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(page.getByText("0 de 1 correctas")).toBeVisible();
  expect(wrong.id).toBeTruthy();

  await page.getByRole("button", { name: "Volver a intentarlo" }).click();
  await page.getByLabel("21 millones").check();
  await page.getByRole("button", { name: "Enviar respuestas" }).click();
  await expect(page.getByText("¡Aprobado!")).toBeVisible();
  expect(correct.id).toBeTruthy();

  // Comprar solo un módulo NO da certificado del curso completo si hay más módulos publicados
  // (aquí el segundo módulo es borrador, así que el alumno tiene todo lo publicado)
  await page.goto("/cuenta/certificados");
  const code = (await db.certificate.findFirstOrThrow()).code;
  await expect(page.getByText(code)).toBeVisible();
  const pdf = await page.request.get(`/api/certificates/${code}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await logout(page);
  await page.goto(`/certificados/verificar/${code}`);
  await expect(page.getByText("✓ Certificado válido")).toBeVisible();
  await expect(page.getByText(STUDENT.name)).toBeVisible();
  expect((await page.request.get(`/api/certificates/${code}/pdf`)).status()).toBe(401);
  await page.goto("/certificados/verificar/JND-XXXX-XXXX-XXXX");
  await expect(page.getByText("✕ Certificado no encontrado")).toBeVisible();
});

test("descarga de material autorizada y panel de alumno para el administrador", async ({ page }) => {
  await login(page, STUDENT);
  await page.goto("/cuenta/materiales");
  await expect(page.getByText("Guía PDF")).toBeVisible();
  const resource = await db.resource.findFirstOrThrow();
  const dl = await page.request.get(`/api/resources/${resource.id}/download`);
  expect(dl.status()).toBe(200);
  expect(dl.headers()["content-disposition"]).toContain("attachment");

  await logout(page);
  await login(page, ADMIN);
  const user = await db.user.findUniqueOrThrow({ where: { email: STUDENT.email } });
  await page.goto(`/admin/alumnos/${user.id}`);
  await expect(page.getByText("Curso E2E de Bitcoin").first()).toBeVisible();
  await expect(page.getByText("100%").first()).toBeVisible();
  // Revocar acceso desde el panel
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revocar" }).first().click();
  await expect(page.getByText("Revocado").first()).toBeVisible();
  await page.goto("/admin/compras");
  await expect(page.getByText(STUDENT.email)).toBeVisible();
  await page.goto("/admin/registro");
  await expect(page.getByText("access.revoke")).toBeVisible();
});

test("diseño adaptable: móvil sin desbordamiento horizontal", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  for (const url of ["/", "/cursos", "/cursos/curso-e2e-de-bitcoin", "/membresias", "/entrar"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("link", { name: "Membresías" }).last()).toBeVisible();
  await ctx.close();
});
