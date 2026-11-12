"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/auth/password";
import { clientInfo, createSession, destroySession, getCurrentUser, revokeAllSessions } from "@/lib/auth/session";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { sendTemplate } from "@/lib/email";
import { env } from "@/lib/env";
import { getGeneralSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/ui/Form";

const email = z.string().trim().toLowerCase().email("Introduce un email válido").max(200);
const password = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(200)
  .regex(/[A-Za-z]/, "Incluye al menos una letra")
  .regex(/[0-9]/, "Incluye al menos un número");

/** Solo rutas internas para evitar redirecciones abiertas */
function safeNext(next: FormDataEntryValue | null) {
  const n = String(next ?? "");
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/cuenta";
}

async function sendVerification(userId: string, to: string, name: string) {
  const token = await issueToken(userId, "EMAIL_VERIFY");
  await sendTemplate(to, "Confirma tu email", [`Hola ${name},`, "Confirma tu dirección de correo para activar tu cuenta en JND."], {
    label: "Confirmar email",
    url: `${env.appUrl}/verificar-email?token=${token}`,
  });
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const settings = await getGeneralSettings();
  if (!settings.registrationOpen) return { error: "El registro está cerrado temporalmente." };
  const { ip } = await clientInfo();
  if (!(await rateLimit(`register:${ip}`, 8, 3600))) return { error: "Demasiados intentos. Inténtalo más tarde." };

  const parsed = z
    .object({
      name: z.string().trim().min(2, "Introduce tu nombre").max(100),
      email,
      password,
      terms: z.literal("on", { errorMap: () => ({ message: "Debes aceptar los términos y la política de privacidad" }) }),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email: mail, password: pw } = parsed.data;

  const exists = await db.user.findUnique({ where: { email: mail } });
  if (exists) return { error: "Ya existe una cuenta con este email. ¿Quieres iniciar sesión?" };

  const user = await db.user.create({ data: { name, email: mail, passwordHash: await hashPassword(pw) } });
  await sendVerification(user.id, user.email, user.name);
  await createSession(user.id);
  redirect(safeNext(fd.get("next")));
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Email o contraseña incorrectos." };
  const { ip } = await clientInfo();
  const key = `login:${parsed.data.email}`;
  if (!(await rateLimit(key, 8, 900)) || !(await rateLimit(`login-ip:${ip}`, 30, 900)))
    return { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    await dummyVerify(parsed.data.password);
    return { error: "Email o contraseña incorrectos." };
  }
  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) return { error: "Email o contraseña incorrectos." };
  if (user.disabledAt) return { error: "Esta cuenta está desactivada. Contacta con soporte." };

  const settings = await getGeneralSettings();
  if (settings.requireEmailVerification && !user.emailVerifiedAt && user.role === "STUDENT")
    return { error: "Debes confirmar tu email antes de entrar. Revisa tu bandeja de entrada." };

  await resetRateLimit(key);
  await createSession(user.id);
  await audit(user.id, "auth.login", undefined, { ip });
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = email.safeParse(fd.get("email"));
  const generic = { ok: true, message: "Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña." };
  if (!parsed.success) return { error: "Introduce un email válido." };
  const { ip } = await clientInfo();
  if (!(await rateLimit(`forgot:${parsed.data}`, 3, 3600)) || !(await rateLimit(`forgot-ip:${ip}`, 10, 3600))) return generic;
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user && !user.disabledAt) {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    await sendTemplate(user.email, "Restablecer contraseña", [`Hola ${user.name},`, "Hemos recibido una solicitud para restablecer tu contraseña. El enlace caduca en 1 hora.", "Si no has sido tú, ignora este mensaje."], {
      label: "Crear nueva contraseña",
      url: `${env.appUrl}/restablecer?token=${token}`,
    });
  }
  return generic;
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ token: z.string().min(10).max(200), password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const userId = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId) return { error: "El enlace no es válido o ha caducado. Solicita uno nuevo." };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() } });
  await revokeAllSessions(userId);
  await audit(userId, "auth.password_reset");
  return { ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." };
}

export async function resendVerificationAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.emailVerifiedAt) return;
  if (!(await rateLimit(`verify:${user.id}`, 3, 3600))) return;
  await sendVerification(user.id, user.email, user.name);
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) return false;
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return true;
}
