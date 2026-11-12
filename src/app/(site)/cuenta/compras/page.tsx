import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/StatusBadge";

export const metadata = { title: "Compras" };

const LABEL = { PENDING: ["Pendiente", "amber"], PAID: ["Pagado", "green"], REFUNDED: ["Reembolsado", "slate"], PARTIALLY_REFUNDED: ["Reembolso parcial", "slate"], FAILED: ["Fallido", "red"], EXPIRED: ["No completado", "slate"] } as const;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  const user = await requireUser("/cuenta/compras");
  const orders = await db.order.findMany({ where: { userId: user.id, status: { not: "PENDING" } }, include: { items: true }, orderBy: { createdAt: "desc" } });
  const pending = await db.order.count({ where: { userId: user.id, status: "PENDING", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historial de compras</h1>
      {pago === "procesando" && (
        <div className="rounded-lg border border-electric/30 bg-electric-100 px-4 py-3 text-sm text-navy">
          Estamos confirmando tu pago con la entidad bancaria. El acceso se activará automáticamente en cuanto se confirme (normalmente en unos segundos). Recarga la página si no aparece.
        </div>
      )}
      {pending > 0 && pago !== "procesando" && <p className="text-sm text-silver-600">Tienes {pending} pago(s) pendiente(s) de confirmación.</p>}
      {orders.length === 0 ? (
        <div className="card p-8 text-center text-sm text-silver-600">Todavía no has realizado ninguna compra.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Estado</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">{formatDateTime(o.paidAt ?? o.createdAt)}</td>
                  <td>{o.items.map((i) => i.description).join(", ")}</td>
                  <td className="whitespace-nowrap">{formatPrice(o.totalCents, o.currency)}</td>
                  <td><Badge tone={LABEL[o.status][1]}>{LABEL[o.status][0]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-silver-600">Los pagos de membresías y sus facturas se consultan en el apartado Membresía.</p>
    </div>
  );
}
