import "server-only";
import type Stripe from "stripe";
import type { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { sendTemplate } from "@/lib/email";
import { formatPrice } from "@/lib/format";
import { getAccessProfile } from "@/lib/access-server";
import { hasFullCourseAccess, hasModuleAccess, ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/access";
import type { SessionUser } from "@/lib/auth/session";

export class BillingError extends Error {}

async function ensureCustomer(user: SessionUser): Promise<string> {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (row.stripeCustomerId) return row.stripeCustomerId;
  const customer = await getStripe().customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Compra individual de un curso o módulo. Devuelve la URL de Stripe Checkout. */
export async function createProductCheckout(user: SessionUser, item: { courseId?: string; moduleId?: string }): Promise<string> {
  const profile = await getAccessProfile();
  let description: string;
  let amount: number;
  let currency: string;
  let returnPath: string;

  if (item.courseId) {
    const course = await db.course.findUnique({ where: { id: item.courseId } });
    if (!course || course.status !== "PUBLISHED" || course.priceCents == null || course.priceCents <= 0)
      throw new BillingError("Este curso no está disponible para la venta.");
    if (hasFullCourseAccess({ ...profile, isStaff: false }, course)) throw new BillingError("Ya tienes acceso a este curso.");
    description = `Curso: ${course.title}`;
    amount = course.priceCents;
    currency = course.currency;
    returnPath = `/cursos/${course.slug}`;
  } else if (item.moduleId) {
    const mod = await db.module.findUnique({ where: { id: item.moduleId }, include: { course: true } });
    if (!mod || mod.status !== "PUBLISHED" || mod.course.status !== "PUBLISHED" || mod.priceCents == null || mod.priceCents <= 0)
      throw new BillingError("Este módulo no está disponible para la venta.");
    if (hasModuleAccess({ ...profile, isStaff: false }, mod)) throw new BillingError("Ya tienes acceso a este módulo.");
    description = `Módulo: ${mod.title} (${mod.course.title})`;
    amount = mod.priceCents;
    currency = mod.course.currency;
    returnPath = `/cursos/${mod.course.slug}`;
  } else throw new BillingError("Producto no válido.");

  const order = await db.order.create({
    data: {
      userId: user.id,
      totalCents: amount,
      currency,
      items: { create: { description, amountCents: amount, courseId: item.courseId ?? null, moduleId: item.moduleId ?? null } },
    },
  });

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: await ensureCustomer(user),
    client_reference_id: user.id,
    line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, product_data: { name: description } } }],
    metadata: { orderId: order.id, userId: user.id },
    payment_intent_data: { metadata: { orderId: order.id, userId: user.id } },
    success_url: `${env.appUrl}/cuenta/compras?pago=procesando`,
    cancel_url: `${env.appUrl}${returnPath}?pago=cancelado`,
    locale: "es",
  });
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
  if (!session.url) throw new BillingError("No se pudo iniciar el pago.");
  return session.url;
}

/** Alta de membresía (suscripción mensual o anual). */
export async function createSubscriptionCheckout(user: SessionUser, planId: string, interval: BillingInterval): Promise<string> {
  const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
  const price = interval === "MONTH" ? plan?.monthlyPriceCents : plan?.yearlyPriceCents;
  if (!plan || !plan.isActive || price == null || price <= 0) throw new BillingError("Esta membresía no está disponible.");

  const existing = await db.subscription.findFirst({ where: { userId: user.id, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } } });
  if (existing) throw new BillingError("Ya tienes una membresía activa. Puedes gestionarla desde tu área privada.");

  const stripe = getStripe();
  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create({ name: `Membresía JND ${plan.name}`, metadata: { planId: plan.id } });
    productId = product.id;
    await db.membershipPlan.update({ where: { id: plan.id }, data: { stripeProductId: productId } });
  }
  const meta = { userId: user.id, planId: plan.id, interval };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await ensureCustomer(user),
    client_reference_id: user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: price,
          product: productId,
          recurring: { interval: interval === "MONTH" ? "month" : "year" },
        },
      },
    ],
    metadata: meta,
    subscription_data: { metadata: meta },
    success_url: `${env.appUrl}/cuenta/suscripcion?pago=procesando`,
    cancel_url: `${env.appUrl}/membresias?pago=cancelado`,
    locale: "es",
  });
  if (!session.url) throw new BillingError("No se pudo iniciar el pago.");
  return session.url;
}

// ───────────────────────────── Webhooks ─────────────────────────────

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
  paused: "PAUSED",
};

function periodEnd(sub: Stripe.Subscription): Date | null {
  // En versiones recientes de la API el fin de periodo está en los items
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const ts = fromItem ?? legacy;
  return ts ? new Date(ts * 1000) : null;
}

export async function fulfillOrder(orderId: string, paymentIntentId: string | null) {
  const order = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
    if (!order || order.status === "PAID" || order.status === "REFUNDED" || order.status === "PARTIALLY_REFUNDED") return null;
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), stripePaymentIntentId: paymentIntentId ?? undefined },
    });
    for (const item of order.items) {
      if (!item.courseId && !item.moduleId) continue;
      await tx.entitlement.create({
        data: { userId: order.userId, courseId: item.courseId, moduleId: item.moduleId, source: "PURCHASE", orderId: order.id },
      });
    }
    return order;
  });
  if (order) {
    await sendTemplate(
      order.user.email,
      "Compra confirmada",
      [`Hola ${order.user.name},`, `Tu pago de ${formatPrice(order.totalCents, order.currency)} se ha confirmado.`, ...order.items.map((i) => `• ${i.description}`), "Ya tienes acceso desde tu área privada."],
      { label: "Ir a mis cursos", url: `${env.appUrl}/cuenta` },
    ).catch(() => {});
  }
  return order;
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const existing = await db.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  const userId = sub.metadata?.userId || existing?.userId;
  const planId = sub.metadata?.planId || existing?.planId;
  const interval = (sub.metadata?.interval as BillingInterval | undefined) || existing?.interval ||
    (sub.items?.data?.[0]?.price?.recurring?.interval === "year" ? "YEAR" : "MONTH");
  if (!userId || !planId) {
    console.error("Suscripción sin metadatos userId/planId", sub.id);
    return;
  }
  const data = {
    status: STATUS_MAP[sub.status] ?? "INCOMPLETE",
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };
  await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { stripeSubscriptionId: sub.id, userId, planId, interval, ...data },
    update: data,
  });
  if (data.status === "ACTIVE" && existing?.status !== "ACTIVE") {
    const user = await db.user.findUnique({ where: { id: userId } });
    const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
    if (user && plan)
      await sendTemplate(user.email, "Membresía activada", [`Hola ${user.name},`, `Tu membresía ${plan.name} ya está activa.`], {
        label: "Empezar a aprender",
        url: `${env.appUrl}/cuenta`,
      }).catch(() => {});
  }
}

async function applyRefund(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const order = await db.order.findUnique({ where: { stripePaymentIntentId: pi } });
  if (!order) return;
  const full = charge.amount_refunded >= charge.amount;
  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: { refundedCents: charge.amount_refunded, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    }),
    ...(full ? [db.entitlement.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
  ]);
}

/** Procesa un evento de Stripe YA VERIFICADO. Idempotente. */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return "duplicate";
  let handled = true;

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "payment" && s.payment_status === "paid" && s.metadata?.orderId) {
        const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
        await fulfillOrder(s.metadata.orderId, pi);
      }
      // Las suscripciones se registran con customer.subscription.*
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.orderId)
        await db.order.updateMany({
          where: { id: s.metadata.orderId, status: "PENDING" },
          data: { status: event.type === "checkout.session.expired" ? "EXPIRED" : "FAILED" },
        });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case "charge.refunded":
      await applyRefund(event.data.object as Stripe.Charge);
      break;
    default:
      handled = false;
  }

  await db.stripeEvent.create({ data: { id: event.id, type: event.type } }).catch(() => {});
  return handled ? "processed" : "ignored";
}
