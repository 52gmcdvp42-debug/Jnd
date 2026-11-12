import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { Form, Submit, ActionButton } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { revokeCertificateAction, restoreCertificateAction } from "@/app/actions/admin/commerce";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Certificados" };

export default async function CertsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const certs = await db.certificate.findMany({
    where: q ? { OR: [{ code: { contains: q.trim(), mode: "insensitive" } }, { studentName: { contains: q.trim(), mode: "insensitive" } }, { courseTitle: { contains: q.trim(), mode: "insensitive" } }] } : {},
    orderBy: { issuedAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Certificados" subtitle="Requisitos configurables en cada curso (progreso, nota mínima, evaluaciones). Cada certificado tiene un identificador único verificable públicamente." />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Código, alumno o curso" className="input max-w-xs" /><button className="btn-dark">Buscar</button></form>
      <div className="card overflow-x-auto">
        {certs.length === 0 ? <p className="p-8 text-center text-sm text-silver-600">No hay certificados emitidos.</p> : (
          <table className="table">
            <thead><tr><th>Código</th><th>Alumno</th><th>Curso</th><th>Emitido</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs"><Link href={`/certificados/verificar/${c.code}`} target="_blank" className="hover:text-electric">{c.code}</Link></td>
                  <td><Link href={`/admin/alumnos/${c.userId}`} className="hover:text-electric">{c.studentName}</Link></td>
                  <td>{c.courseTitle}</td>
                  <td className="whitespace-nowrap">{formatDate(c.issuedAt)}</td>
                  <td>{c.revokedAt ? <Badge tone="red">Revocado</Badge> : <Badge tone="green">Válido</Badge>}</td>
                  <td className="min-w-[230px]">
                    {c.revokedAt ? (
                      <ActionButton action={restoreCertificateAction} hidden={{ id: c.id }}>Restaurar</ActionButton>
                    ) : (
                      <Form action={revokeCertificateAction} className="flex gap-2" confirm="¿Revocar este certificado? Dejará de ser válido en la verificación pública.">
                        <input type="hidden" name="id" value={c.id} />
                        <input name="reason" placeholder="Motivo" className="input py-1 text-xs" />
                        <Submit className="btn-outline btn-sm text-red-600" pendingText="…">Revocar</Submit>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
