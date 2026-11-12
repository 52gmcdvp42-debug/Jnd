import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Verificación de certificado", robots: { index: false } };

export default async function VerifyCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await db.certificate.findUnique({ where: { code: decodeURIComponent(code).toUpperCase() } });
  const valid = cert && !cert.revokedAt;
  return (
    <div className="container-x max-w-xl py-20">
      <div className={`card overflow-hidden`}>
        <div className={`px-6 py-4 text-sm font-semibold text-white ${valid ? "bg-emerald-600" : "bg-red-600"}`}>
          {valid ? "✓ Certificado válido" : cert ? "✕ Certificado revocado" : "✕ Certificado no encontrado"}
        </div>
        <div className="space-y-3 p-6">
          <p className="font-mono text-sm text-silver-600">{decodeURIComponent(code)}</p>
          {cert ? (
            <dl className="grid grid-cols-3 gap-y-3 text-sm">
              <dt className="text-silver-600">Alumno</dt><dd className="col-span-2 font-semibold">{cert.studentName}</dd>
              <dt className="text-silver-600">Formación</dt><dd className="col-span-2 font-semibold">{cert.courseTitle}</dd>
              <dt className="text-silver-600">Emitido</dt><dd className="col-span-2">{formatDate(cert.issuedAt)}</dd>
              {cert.revokedAt && (<><dt className="text-silver-600">Revocado</dt><dd className="col-span-2">{formatDate(cert.revokedAt)}</dd></>)}
            </dl>
          ) : (
            <p className="text-sm text-silver-600">No existe ningún certificado emitido por JND con este identificador.</p>
          )}
        </div>
      </div>
      <p className="mt-6 text-center text-sm"><Link href="/certificados/verificar" className="text-electric hover:underline">Verificar otro certificado</Link></p>
    </div>
  );
}
