"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, revokeAllSessions } from "@/lib/auth/session";
import { issueToken } from "@/lib/auth/tokens";
import { sendTemplate } from "@/lib/email";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { run, str, UserError } from "./_util";
import type { FormState } from "@/components/ui/Form";

export async function updateUserAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return run(async () => {
    const id = str(fd, "id");
    const role = z.enum(["STUDENT", "EDITOR", "ADMIN"]).parse(str(fd, "role"));
    const name = z.string().trim().min(2).max(100).parse(str(fd, "name"));
    if (id === admin.id && role !== "ADMIN") throw new UserError("No puedes quitarte a ti mismo el rol de administrador.");
    const before = await db.user.findUniqueOrThrow({ where: { id } });
    await db.user.update({ where: { id }, data: { role, name } });
    if (before.role !== role) {
      await revokeAllSessions(id);
      await audit(admin.id, "user.role", id, { from: before.role, to: role });
    }
    revalidatePath(`/admin/alumnos/${id}`);
  });
}

export async function toggleDisableUserAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (id === admin.id) return;
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { disabledAt: u.disabledAt ? null : new Date() } });
  if (!u.disabledAt) await revokeAllSessions(id);
  await audit(admin.id, u.disabledAt ? "user.enable" : "user.disable", id);
  revalidatePath(`/admin/alumnos/${id}`);
}

export async function sendResetLinkAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return run(async () => {
    const u = await db.user.findUniqueOrThrow({ where: { id: str(fd, "id") } });
    const token = await issueToken(u.id, "PASSWORD_RESET");
    await sendTemplate(u.email, "Restablecer contraseña", [`Hola ${u.name},`, "Se ha solicitado restablecer tu contraseña. El enlace caduca en 1 hora."], {
      label: "Crear nueva contraseña",
      url: `${env.appUrl}/restablecer?token=${token}`,
    });
    await audit(admin.id, "user.reset_link", u.id);
    return "Enlace de restablecimiento enviado al alumno.";
  });
}

export async function resetProgressAction(fd: FormData) {
  const admin = await requireAdmin();
  const userId = str(fd, "userId");
  const courseId = str(fd, "courseId");
  await db.lessonProgress.deleteMany({ where: { userId, lesson: { module: { courseId } } } });
  await audit(admin.id, "progress.reset", userId, { courseId });
  revalidatePath(`/admin/alumnos/${userId}`);
}
