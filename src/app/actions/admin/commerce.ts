"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { parsePriceToCents, slugify } from "@/lib/format";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { certificateCode } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { run, str, optStr, bool, int, UserError } from "./_util";
import type { FormState } from "@/components/ui/Form";

// ─────────── Membresías ───────────

export async function savePlanAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  let createdId = "";
  const res = await run(async () => {
    const id = optStr(fd, "id");
    const name = z.string().min(2, "El nombre es obligatorio").max(80).parse(str(fd, "name"));
    const monthly = parsePriceToCents(fd.get("monthlyPrice"));
    const yearly = parsePriceToCents(fd.get("yearlyPrice"));
    const isActive = bool(fd, "isActive");
    if (isActive && !monthly && !yearly) throw new UserError("Para activar la membresía indica al menos un precio (mensual o anual).");
    const courseIds = fd.getAll("courseIds").map(String);
    const categoryIds = fd.getAll("categoryIds").map(String);
    const data = {
      name,
      slug: slugify(str(fd, "slug") || name),
      description: optStr(fd, "description"),
      benefits: str(fd, "benefits").split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 20),
      monthlyPriceCents: monthly,
      yearlyPriceCents: yearly,
      isActive,
      sortOrder: int(fd, "sortOrder"),
      includesAllCourses: bool(fd, "includesAllCourses"),
      allowDownloads: bool(fd, "allowDownloads"),
      allowCertificates: bool(fd, "allowCertificates"),
    };
    if (id) {
      await db.membershipPlan.update({
        where: { id },
        data: { ...data, includedCourses: { set: courseIds.map((c) => ({ id: c })) }, includedCategories: { set: categoryIds.map((c) => ({ id: c })) } },
      });
      await audit(user.id, "plan.update", id, { monthly, yearly, isActive });
    } else {
      const p = await db.membershipPlan.create({
        data: { ...data, includedCourses: { connect: courseIds.map((c) => ({ id: c })) }, includedCategories: { connect: categoryIds.map((c) => ({ id: c })) } },
      });
      createdId = p.id;
      await audit(user.id, "plan.create", p.id);
    }
    revalidatePath("/admin", "layout");
    revalidatePath("/membresias");
    return id ? "Membresía actualizada. Los nuevos precios se aplican a las nuevas suscripciones." : undefined;
  });
  if (createdId) redirect(`/admin/membresias/${createdId}`);
  return res;
}

export async function deletePlanAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = str(fd, "id");
  const res = await run(async () => {
    if (await db.subscription.count({ where: { planId: id } })) throw new UserError("Esta membresía tiene suscripciones. Desactívala en lugar de eliminarla.");
    await db.membershipPlan.delete({ where: { id } });
    await audit(user.id, "plan.delete", id);
  });
  if (res?.ok) redirect("/admin/membresias");
  return res;
}

// ─────────── Reembolsos ───────────

export async function refundOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return run(async () => {
    if (!stripeEnabled()) throw new UserError("Stripe no está configurado.");
    const order = await db.order.findUniqueOrThrow({ where: { id: str(fd, "id") } });
    if (!order.stripePaymentIntentId || !["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) throw new UserError("Este pedido no admite reembolso.");
    const amount = parsePriceToCents(fd.get("amount"));
    const remaining = order.totalCents - order.refundedCents;
    if (amount != null && (amount <= 0 || amount > remaining)) throw new UserError("Importe de reembolso no válido.");
    await getStripe().refunds.create(
      { payment_intent: order.stripePaymentIntentId, ...(amount ? { amount } : {}), metadata: { orderId: order.id, adminId: user.id } },
      { idempotencyKey: `refund-${order.id}-${order.refundedCents}-${amount ?? "full"}` },
    );
    await audit(user.id, "order.refund", order.id, { amount: amount ?? remaining });
    return "Reembolso solicitado a Stripe. El estado del pedido y los accesos se actualizarán al recibir la confirmación (webhook).";
  });
}

// ─────────── Accesos manuales ───────────

export async function grantAccessAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return run(async () => {
    const userId = str(fd, "userId");
    const target = str(fd, "target"); // "course:<id>" | "module:<id>"
    const [kind, id] = target.split(":");
    if (!id || !["course", "module"].includes(kind)) throw new UserError("Selecciona un curso o módulo.");
    const days = int(fd, "days", 0);
    const e = await db.entitlement.create({
      data: {
        userId,
        source: "ADMIN_GRANT",
        courseId: kind === "course" ? id : null,
        moduleId: kind === "module" ? id : null,
        expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
      },
    });
    await audit(user.id, "access.grant", userId, { entitlementId: e.id, target, days });
    revalidatePath(`/admin/alumnos/${userId}`);
    return "Acceso concedido.";
  });
}

export async function revokeAccessAction(fd: FormData) {
  const user = await requireAdmin();
  const e = await db.entitlement.update({ where: { id: str(fd, "id") }, data: { revokedAt: new Date() } });
  await audit(user.id, "access.revoke", e.userId, { entitlementId: e.id });
  revalidatePath(`/admin/alumnos/${e.userId}`);
}

export async function restoreAccessAction(fd: FormData) {
  const user = await requireAdmin();
  const e = await db.entitlement.update({ where: { id: str(fd, "id") }, data: { revokedAt: null } });
  await audit(user.id, "access.restore", e.userId, { entitlementId: e.id });
  revalidatePath(`/admin/alumnos/${e.userId}`);
}

// ─────────── Certificados ───────────

export async function revokeCertificateAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return run(async () => {
    const id = str(fd, "id");
    await db.certificate.update({ where: { id }, data: { revokedAt: new Date(), revokeReason: optStr(fd, "reason") } });
    await audit(user.id, "certificate.revoke", id);
    revalidatePath("/admin/certificados");
    return "Certificado revocado.";
  });
}

export async function restoreCertificateAction(fd: FormData) {
  const user = await requireAdmin();
  const id = str(fd, "id");
  await db.certificate.update({ where: { id }, data: { revokedAt: null, revokeReason: null } });
  await audit(user.id, "certificate.restore", id);
  revalidatePath("/admin/certificados");
}

/** Emisión manual (excepciones decididas por el administrador). */
export async function issueCertificateManuallyAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return run(async () => {
    const userId = str(fd, "userId");
    const courseId = str(fd, "courseId");
    const [u, c] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId } }), db.course.findUniqueOrThrow({ where: { id: courseId } })]);
    const existing = await db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (existing && !existing.revokedAt) throw new UserError("El alumno ya tiene un certificado válido de este curso.");
    if (existing) await db.certificate.update({ where: { id: existing.id }, data: { revokedAt: null, revokeReason: null, issuedAt: new Date(), code: certificateCode() } });
    else await db.certificate.create({ data: { code: certificateCode(), userId, courseId, studentName: u.name, courseTitle: c.title } });
    await audit(admin.id, "certificate.issue_manual", userId, { courseId });
    revalidatePath(`/admin/alumnos/${userId}`);
    return "Certificado emitido.";
  });
}
