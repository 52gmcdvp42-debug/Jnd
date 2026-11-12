import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { POST } from "@/app/api/webhooks/stripe/route";
import { loadAccessProfile } from "@/lib/access-server";
import { canViewLesson } from "@/lib/access";

const SECRET = "whsec_test_secret";
let n = 0;

async function send(type: string, object: Record<string, unknown>, opts: { badSignature?: boolean; id?: string } = {}) {
  const payload = JSON.stringify({ id: opts.id ?? `evt_${Date.now()}_${n++}`, object: "event", type, data: { object } });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: opts.badSignature ? "whsec_wrong" : SECRET });
  return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
}

let userId = "";
let courseId = "";
let moduleId = "";
let lessonId = "";
let planId = "";

beforeAll(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "User","Course","Category","MembershipPlan","StripeEvent" CASCADE`);
  const user = await db.user.create({ data: { email: "alumno@test.local", name: "Alumno Test", passwordHash: "x" } });
  const course = await db.course.create({
    data: {
      title: "Curso de prueba",
      slug: "curso-prueba",
      status: "PUBLISHED",
      priceCents: 9900,
      modules: { create: [{ title: "M1", status: "PUBLISHED", priceCents: 2900, lessons: { create: { title: "L1", status: "PUBLISHED" } } }, { title: "M2", status: "PUBLISHED" }] },
    },
    include: { modules: { include: { lessons: true } } },
  });
  const plan = await db.membershipPlan.create({ data: { name: "Completa", slug: "completa-test", monthlyPriceCents: 2900, isActive: true, includesAllCourses: true } });
  userId = user.id;
  courseId = course.id;
  moduleId = course.modules.find((m) => m.title === "M1")!.id;
  lessonId = course.modules.find((m) => m.title === "M1")!.lessons[0].id;
  planId = plan.id;
});

beforeEach(async () => {
  await db.entitlement.deleteMany();
  await db.order.deleteMany();
  await db.subscription.deleteMany();
});

afterAll(() => db.$disconnect());

async function canSeeLesson() {
  const profile = await loadAccessProfile(userId, "STUDENT");
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { module: { include: { course: true } } } });
  return canViewLesson(profile, lesson);
}

async function pendingOrder(totalCents = 9900, item: { courseId?: string; moduleId?: string } = { courseId }) {
  return db.order.create({ data: { userId, totalCents, currency: "eur", items: { create: { description: "x", amountCents: totalCents, ...item } } } });
}

describe("webhook de Stripe", () => {
  it("rechaza firmas no válidas y no concede acceso", async () => {
    const order = await pendingOrder();
    const res = await send("checkout.session.completed", { mode: "payment", payment_status: "paid", metadata: { orderId: order.id }, payment_intent: "pi_bad" }, { badSignature: true });
    expect(res.status).toBe(400);
    expect(await canSeeLesson()).toBe(false);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("un pedido pendiente (usuario vuelve de la página de pago sin confirmación) NO da acceso", async () => {
    await pendingOrder();
    expect(await canSeeLesson()).toBe(false);
  });

  it("pago confirmado → acceso automático; evento repetido es idempotente", async () => {
    const order = await pendingOrder();
    const evt = { mode: "payment", payment_status: "paid", metadata: { orderId: order.id }, payment_intent: "pi_1" };
    expect((await send("checkout.session.completed", evt, { id: "evt_same" })).status).toBe(200);
    expect(await canSeeLesson()).toBe(true);
    await send("checkout.session.completed", evt, { id: "evt_same" });
    await send("checkout.session.completed", evt); // otro id, mismo pedido
    expect(await db.entitlement.count({ where: { orderId: order.id } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("pago asíncrono aún no cobrado no concede acceso hasta async_payment_succeeded", async () => {
    const order = await pendingOrder();
    await send("checkout.session.completed", { mode: "payment", payment_status: "unpaid", metadata: { orderId: order.id }, payment_intent: "pi_async" });
    expect(await canSeeLesson()).toBe(false);
    await send("checkout.session.async_payment_succeeded", { mode: "payment", payment_status: "paid", metadata: { orderId: order.id }, payment_intent: "pi_async" });
    expect(await canSeeLesson()).toBe(true);
  });

  it("compra de módulo individual da acceso solo a ese módulo", async () => {
    const order = await pendingOrder(2900, { moduleId });
    await send("checkout.session.completed", { mode: "payment", payment_status: "paid", metadata: { orderId: order.id }, payment_intent: "pi_mod" });
    const profile = await loadAccessProfile(userId, "STUDENT");
    expect(profile.moduleIds.has(moduleId)).toBe(true);
    expect(profile.courseIds.size).toBe(0);
    expect(await canSeeLesson()).toBe(true);
  });

  it("reembolso total retira el acceso; parcial lo mantiene", async () => {
    const order = await pendingOrder();
    await send("checkout.session.completed", { mode: "payment", payment_status: "paid", metadata: { orderId: order.id }, payment_intent: "pi_ref" });
    await send("charge.refunded", { payment_intent: "pi_ref", amount: 9900, amount_refunded: 1000 });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PARTIALLY_REFUNDED");
    expect(await canSeeLesson()).toBe(true);
    await send("charge.refunded", { payment_intent: "pi_ref", amount: 9900, amount_refunded: 9900 });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
    expect(await canSeeLesson()).toBe(false);
  });

  it("suscripción: alta, renovación, cancelación programada y baja", async () => {
    const sub = (status: string, extra: Record<string, unknown> = {}) => ({
      id: "sub_1",
      status,
      metadata: { userId, planId, interval: "MONTH" },
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { recurring: { interval: "month" } } }] },
      ...extra,
    });
    await send("customer.subscription.created", sub("incomplete"));
    expect(await canSeeLesson()).toBe(false);
    await send("customer.subscription.updated", sub("active"));
    expect(await canSeeLesson()).toBe(true);
    await send("customer.subscription.updated", sub("active", { cancel_at_period_end: true }));
    expect((await db.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: "sub_1" } })).cancelAtPeriodEnd).toBe(true);
    expect(await canSeeLesson()).toBe(true); // mantiene acceso hasta fin de periodo
    await send("customer.subscription.deleted", sub("canceled", { canceled_at: Math.floor(Date.now() / 1000) }));
    expect(await canSeeLesson()).toBe(false);
  });

  it("checkout caducado marca el pedido como caducado", async () => {
    const order = await pendingOrder();
    await send("checkout.session.expired", { mode: "payment", metadata: { orderId: order.id } });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("EXPIRED");
  });
});
