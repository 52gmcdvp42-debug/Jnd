import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Alumnos" };
const PAGE = 50;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string; rol?: string }> }) {
  await requireAdmin();
  const { q, p, rol } = await searchParams;
  const page = Math.max(1, parseInt(p ?? "1", 10) || 1);
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q.trim(), mode: "insensitive" } }, { name: { contains: q.trim(), mode: "insensitive" } }] } : {}),
    ...(rol && ["STUDENT", "EDITOR", "ADMIN"].includes(rol) ? { role: rol as "STUDENT" } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { _count: { select: { entitlements: { where: { revokedAt: null } } } }, subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } }, include: { plan: true } } },
    }),
    db.user.count({ where }),
  ]);
  return (
    <>
      <PageHeader title="Alumnos" subtitle={`${total} usuarios`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o email" className="input max-w-xs" />
        <select name="rol" defaultValue={rol ?? ""} className="input max-w-[180px]">
          <option value="">Todos los roles</option><option value="STUDENT">Alumnos</option><option value="EDITOR">Editores</option><option value="ADMIN">Administradores</option>
        </select>
        <button className="btn-dark">Filtrar</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Nombre</th><th>Email</th><th>Accesos</th><th>Membresía</th><th>Alta</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name} {u.role !== "STUDENT" && <Badge tone="blue">{u.role}</Badge>} {u.disabledAt && <Badge tone="red">Desactivado</Badge>}</td>
                <td>{u.email}</td>
                <td>{u._count.entitlements}</td>
                <td>{u.subscriptions[0]?.plan.name ?? "—"}</td>
                <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td className="text-right"><Link href={`/admin/alumnos/${u.id}`} className="btn-outline btn-sm">Ver</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link className="text-electric" href={`?${new URLSearchParams({ q: q ?? "", rol: rol ?? "", p: String(page - 1) })}`}>← Anteriores</Link> : <span />}
        {page * PAGE < total ? <Link className="text-electric" href={`?${new URLSearchParams({ q: q ?? "", rol: rol ?? "", p: String(page + 1) })}`}>Siguientes →</Link> : <span />}
      </div>
    </>
  );
}
