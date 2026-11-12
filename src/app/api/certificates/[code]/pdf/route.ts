import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { getCertificateSettings } from "@/lib/settings";
import { env } from "@/lib/env";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  const cert = await db.certificate.findUnique({ where: { code } });
  if (!cert || (cert.userId !== user.id && !isStaff(user.role))) return new NextResponse("No encontrado", { status: 404 });
  if (cert.revokedAt) return new NextResponse("Certificado revocado", { status: 410 });
  const s = await getCertificateSettings();
  const pdf = await renderCertificatePdf({
    code: cert.code,
    studentName: cert.studentName,
    courseTitle: cert.courseTitle,
    issuedAt: cert.issuedAt,
    verifyUrl: `${env.appUrl}/certificados/verificar/${cert.code}`,
    signerName: s.signerName,
    signerTitle: s.signerTitle,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="certificado-${cert.code}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
