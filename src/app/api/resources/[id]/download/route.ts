import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccessProfile } from "@/lib/access-server";
import { canDownloadIn, canViewLesson } from "@/lib/access";
import { readLocalStream, signedDownloadUrl } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

/** Descarga de materiales: comprueba permisos en servidor y entrega un enlace temporal. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.resource.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, categoryId: true, status: true } },
      module: { select: { id: true, status: true, course: { select: { id: true, categoryId: true, status: true } } } },
      lesson: { select: { id: true, status: true, isFreePreview: true, module: { select: { id: true, status: true, course: { select: { id: true, categoryId: true, status: true } } } } } },
    },
  });
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  const profile = await getAccessProfile();

  let allowed = false;
  if (r.isPublic) allowed = true;
  else if (r.lesson) allowed = canViewLesson(profile, r.lesson) && (r.lesson.isFreePreview || canDownloadIn(profile, r.lesson.module.course, r.lesson.module.id));
  else if (r.module) allowed = r.module.status === "PUBLISHED" && canDownloadIn(profile, r.module.course, r.module.id);
  else if (r.course) allowed = canDownloadIn(profile, r.course, null);
  if (!allowed) return new NextResponse("No autorizado", { status: profile.userId ? 403 : 401 });

  if (profile.userId && !(await rateLimit(`download:${profile.userId}`, 60, 3600)))
    return new NextResponse("Demasiadas descargas. Inténtalo más tarde.", { status: 429 });

  if (r.externalUrl) return NextResponse.redirect(r.externalUrl);
  if (!r.storageKey) return new NextResponse("Archivo no disponible", { status: 404 });
  if (profile.userId) await audit(profile.userId, "resource.download", r.id);

  const signed = await signedDownloadUrl(r.storageKey, r.fileName ?? "archivo");
  if (signed) return NextResponse.redirect(signed);
  const file = await readLocalStream(r.storageKey);
  if (!file) return new NextResponse("Archivo no disponible", { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": r.mimeType ?? "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(r.fileName ?? "archivo")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
