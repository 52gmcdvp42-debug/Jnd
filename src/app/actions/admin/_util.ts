import "server-only";
import { ZodError } from "zod";
import type { FormState } from "@/components/ui/Form";

export class UserError extends Error {}

/** Ejecuta una acción del panel devolviendo un estado amigable para el formulario. */
export async function run(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const message = await fn();
    return { ok: true, message: message || "Cambios guardados." };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    if (e instanceof UserError) return { error: e.message };
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Datos no válidos." };
    if (e instanceof Error && e.message === "Precio no válido") return { error: "Precio no válido. Usa el formato 49,90." };
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") return { error: "Ya existe un elemento con ese identificador (slug)." };
    console.error(e);
    return { error: "No se ha podido guardar. Revisa los datos e inténtalo de nuevo." };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const bool = (fd: FormData, k: string) => fd.get(k) === "on";
export const int = (fd: FormData, k: string, def = 0) => {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) ? n : def;
};
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
