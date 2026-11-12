import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

const SESSION_DAYS = 30;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-jnd_session" : "jnd_session";

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "emailVerifiedAt">;

export async function clientInfo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const { ip, userAgent } = await clientInfo();
  await db.session.create({ data: { id: sha256(token), userId, expiresAt, ip, userAgent } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Usuario actual (una consulta por petición gracias a cache). Valida en servidor contra la BD. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true, disabledAt: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.disabledAt) return null;
  if (Date.now() - session.lastUsedAt.getTime() > REFRESH_AFTER_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) },
    }).catch(() => {});
  }
  const { disabledAt: _d, ...user } = session.user;
  return user;
});

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return user;
}

export const isStaff = (role: Role) => role === "ADMIN" || role === "EDITOR";

/** Contenidos: ADMIN o EDITOR */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (!isStaff(user.role)) redirect("/cuenta");
  return user;
}

/** Pagos, alumnos, membresías, ajustes: solo ADMIN */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect(isStaff(user.role) ? "/admin" : "/cuenta");
  return user;
}

export async function revokeAllSessions(userId: string, exceptCurrent = false) {
  let keep: string | undefined;
  if (exceptCurrent) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    keep = token ? sha256(token) : undefined;
  }
  await db.session.deleteMany({ where: { userId, ...(keep ? { NOT: { id: keep } } : {}) } });
}
