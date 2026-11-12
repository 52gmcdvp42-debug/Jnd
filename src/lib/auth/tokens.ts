import "server-only";
import type { TokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const TTL: Record<TokenType, number> = { EMAIL_VERIFY: 48 * 3600_000, PASSWORD_RESET: 3600_000 };

export async function issueToken(userId: string, type: TokenType): Promise<string> {
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = randomToken(32);
  await db.authToken.create({ data: { id: sha256(token), userId, type, expiresAt: new Date(Date.now() + TTL[type]) } });
  return token;
}

/** Consume un token de un solo uso. Devuelve el userId o null. */
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  const id = sha256(token);
  const row = await db.authToken.findUnique({ where: { id } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const res = await db.authToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count === 1 ? row.userId : null;
}
