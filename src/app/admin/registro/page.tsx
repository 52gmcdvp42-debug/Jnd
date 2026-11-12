import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Registro de actividad" };

export default async function AuditPage() {
  await requireAdmin();
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { email: true } } } });
  return (
    <>
      <PageHeader title="Registro de actividad" subtitle="Últimas 300 acciones relevantes (cambios del panel, accesos, reembolsos, inicios de sesión)." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Objeto</th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td><td>{l.user?.email ?? "sistema"}</td><td className="font-mono text-xs">{l.action}</td><td className="font-mono text-xs text-silver-600">{l.target}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
