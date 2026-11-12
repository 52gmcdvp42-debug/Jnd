import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { Form, Submit } from "@/components/ui/Form";
import { Badge } from "@/components/ui/StatusBadge";
import { refundOrderAction } from "@/app/actions/admin/commerce";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata = { title: "Compras" };
const TONE: Record<OrderStatus, "green" | "amber" | "slate" | "red"> = { PAID: "green", PENDING: "amber", REFUNDED: "slate", PARTIALLY_REFUNDED: "slate", FAILED: "red", EXPIRED: "slate" };
const LABEL: Record<OrderStatus, string> = { PAID: "Pagado", PENDING: "Pendiente", REFUNDED: "Reembolsado", PARTIALLY_REFUNDED: "Reembolso parcial", FAILED: "Fallido", EXPIRED: "Caducado" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin();
  const { estado } = await searchParams;
  const filter = estado && estado in LABEL ? (estado as OrderStatus) : undefined;
  const [orders, subs] = await Promise.all([
    db.order.findMany({ where: filter ? { status: filter } : { status: { not: "EXPIRED" } }, orderBy: { createdAt: "desc" }, take: 200, include: { user: true, items: true } }),
    db.subscription.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: true, plan: true } }),
  ]);
  return (
    <>
      <PageHeader title="Compras" subtitle="Pedidos de cursos y módulos. Los reembolsos se procesan en Stripe y los accesos se retiran automáticamente al confirmarse un reembolso total." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/compras" className={`badge px-3 py-1.5 ${!filter ? "bg-navy text-snow" : "bg-white ring-1 ring-silver-300"}`}>Todas</Link>
        {(Object.keys(LABEL) as OrderStatus[]).map((s) => <Link key={s} href={`?estado=${s}`} className={`badge px-3 py-1.5 ${filter === s ? "bg-navy text-snow" : "bg-white ring-1 ring-silver-300"}`}>{LABEL[s]}</Link>)}
      </div>
      <div className="card overflow-x-auto">
        {orders.length === 0 ? <p className="p-8 text-center text-sm text-silver-600">Sin pedidos.</p> : (
          <table className="table">
            <thead><tr><th>Fecha</th><th>Alumno</th><th>Concepto</th><th>Importe</th><th>Estado</th><th>Reembolso</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">{formatDateTime(o.paidAt ?? o.createdAt)}</td>
                  <td><Link href={`/admin/alumnos/${o.userId}`} className="hover:text-electric">{o.user.email}</Link></td>
                  <td>{o.items.map((i) => i.description).join(", ")}</td>
                  <td className="whitespace-nowrap">{formatPrice(o.totalCents, o.currency)}{o.refundedCents > 0 && <span className="block text-xs text-silver-600">−{formatPrice(o.refundedCents, o.currency)}</span>}</td>
                  <td><Badge tone={TONE[o.status]}>{LABEL[o.status]}</Badge></td>
                  <td className="min-w-[220px]">
                    {(o.status === "PAID" || o.status === "PARTIALLY_REFUNDED") && o.stripePaymentIntentId && (
                      <Form action={refundOrderAction} className="flex flex-wrap items-center gap-2" confirm="¿Confirmas el reembolso? Esta acción se envía a Stripe y no se puede deshacer.">
                        <input type="hidden" name="id" value={o.id} />
                        <input name="amount" placeholder="Total" className="input w-24 py-1 text-xs" aria-label="Importe a reembolsar (vacío = total)" />
                        <Submit className="btn-outline btn-sm" pendingText="…">Reembolsar</Submit>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <h2 className="mb-3 mt-10 text-lg font-semibold">Suscripciones recientes</h2>
      <div className="card overflow-x-auto">
        {subs.length === 0 ? <p className="p-6 text-center text-sm text-silver-600">Sin suscripciones.</p> : (
          <table className="table">
            <thead><tr><th>Alta</th><th>Alumno</th><th>Plan</th><th>Periodicidad</th><th>Estado</th><th>Fin de periodo</th></tr></thead>
            <tbody>{subs.map((s) => <tr key={s.id}><td className="whitespace-nowrap">{formatDateTime(s.createdAt)}</td><td><Link className="hover:text-electric" href={`/admin/alumnos/${s.userId}`}>{s.user.email}</Link></td><td>{s.plan.name}</td><td>{s.interval === "MONTH" ? "Mensual" : "Anual"}</td><td>{s.status}{s.cancelAtPeriodEnd && " · cancelará"}</td><td>{formatDateTime(s.currentPeriodEnd)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-silver-600">Los reembolsos de suscripciones y las facturas se gestionan desde el panel de Stripe.</p>
    </>
  );
}
