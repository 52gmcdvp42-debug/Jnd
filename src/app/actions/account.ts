"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, revokeAllSessions } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/ui/Form";

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = z.string().trim().min(2).max(100).safeParse(fd.get("name"));
  if (!name.success) return { error: "Introduce un nombre válido (2-100 caracteres)." };
  await db.user.update({ where: { id: user.id }, data: { name: name.data } });
  revalidatePath("/cuenta", "layout");
  return { ok: true, message: "Perfil actualizado." };
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimit(`pwchange:${user.id}`, 5, 900))) return { error: "Demasiados intentos. Espera unos minutos." };
  const parsed = z
    .object({
      current: z.string().min(1),
      password: z.string().min(10, "Mínimo 10 caracteres").max(200).regex(/[A-Za-z]/, "Incluye letras").regex(/[0-9]/, "Incluye números"),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, parsed.data.current))) return { error: "La contraseña actual no es correcta." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await revokeAllSessions(user.id, true);
  await audit(user.id, "auth.password_change");
  return { ok: true, message: "Contraseña actualizada. Se han cerrado las demás sesiones." };
}

export async function logoutOtherSessionsAction() {
  const user = await requireUser();
  await revokeAllSessions(user.id, true);
  revalidatePath("/cuenta/perfil");
}

async function ownSubscription(userId: string, id: string) {
  const sub = await db.subscription.findUnique({ where: { id } });
  if (!sub || sub.userId !== userId) throw new Error("Suscripción no encontrada");
  return sub;
}

export async function cancelSubscriptionAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!stripeEnabled()) return { error: "Pagos no configurados." };
  const sub = await ownSubscription(user.id, String(fd.get("id")));
  await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  await audit(user.id, "subscription.cancel", sub.id);
  revalidatePath("/cuenta/suscripcion");
  return { ok: true, message: "Tu membresía se cancelará al final del periodo actual. Mantienes el acceso hasta entonces." };
}

export async function resumeSubscriptionAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!stripeEnabled()) return { error: "Pagos no configurados." };
  const sub = await ownSubscription(user.id, String(fd.get("id")));
  await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
  await db.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false } });
  await audit(user.id, "subscription.resume", sub.id);
  revalidatePath("/cuenta/suscripcion");
  return { ok: true, message: "Tu membresía seguirá renovándose automáticamente." };
}

/** Portal de cliente de Stripe: métodos de pago y facturas. */
export async function billingPortalAction() {
  const user = await requireUser();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!stripeEnabled() || !row.stripeCustomerId) redirect("/cuenta/suscripcion");
  const session = await getStripe().billingPortal.sessions.create({ customer: row.stripeCustomerId, return_url: `${env.appUrl}/cuenta/suscripcion`, locale: "es" });
  redirect(session.url);
}
