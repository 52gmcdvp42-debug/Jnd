import { NextResponse } from "next/server";
import { readLocalStream } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" };

/** Archivos PÚBLICOS (portadas) con el driver local. Nunca sirve la carpeta private/. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");
  if (key[0] !== "public" || path.includes("..")) return new NextResponse("No encontrado", { status: 404 });
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext]) return new NextResponse("No encontrado", { status: 404 });
  const file = await readLocalStream(path);
  if (!file) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(file.stream, { headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
