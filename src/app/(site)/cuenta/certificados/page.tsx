import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Certificados" };

export default async function CertificatesPage() {
  const user = await requireUser("/cuenta/certificados");
  const certs = await db.certificate.findMany({ where: { userId: user.id }, orderBy: { issuedAt: "desc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Certificados</h1>
      {certs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-silver-600">Aún no tienes certificados. Completa los requisitos de un curso para obtenerlo.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((c) => (
            <div key={c.id} className="card p-5">
              <p className="eyebrow">{c.revokedAt ? "Revocado" : "Certificado"}</p>
              <h2 className="mt-1 font-semibold">{c.courseTitle}</h2>
              <p className="mt-1 text-xs text-silver-600">Emitido el {formatDate(c.issuedAt)} · <span className="font-mono">{c.code}</span></p>
              {!c.revokedAt && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`/api/certificates/${c.code}/pdf`} className="btn-primary btn-sm">Descargar PDF</a>
                  <Link href={`/certificados/verificar/${c.code}`} className="btn-outline btn-sm">Enlace de verificación</Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
