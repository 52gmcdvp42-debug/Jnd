import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatPrice } from "@/lib/format";
import { Form, Submit } from "@/components/ui/Form";
import { billingPortalAction, cancelSubscriptionAction, resumeSubscriptionAction } from "@/app/actions/account";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/access";

export const metadata = { title: "Membresía" };

const STATUS: Record<string, string> = { ACTIVE: "Activa", TRIALING: "En prueba", PAST_DUE: "Pago pendiente", CANCELED: "Cancelada", UNPAID: "Impagada", INCOMPLETE: "Incompleta", INCOMPLETE_EXPIRED: "Caducada", PAUSED: "Pausada" };

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  const user = await requireUser("/cuenta/suscripcion");
  const subs = await db.subscription.findMany({ where: { userId: user.id }, include: { plan: true }, orderBy: { createdAt: "desc" } });
  const active = subs.find((s) => (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status));
  const me = await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Membresía</h1>
      {pago === "procesando" && !active && (
        <div className="rounded-lg border border-electric/30 bg-electric-100 px-4 py-3 text-sm">Estamos confirmando tu suscripción. Se activará automáticamente en cuanto Stripe confirme el pago. Recarga en unos segundos.</div>
      )}
      {active ? (
        <div className="card p-6">
          <p className="eyebrow">Membresía actual</p>
          <h2 className="mt-1 text-xl font-bold">{active.plan.name}</h2>
          <p className="mt-1 text-sm text-silver-600">
            {active.interval === "MONTH" ? "Mensual" : "Anual"} · {formatPrice(active.interval === "MONTH" ? active.plan.monthlyPriceCents : active.plan.yearlyPriceCents, active.plan.currency)} · Estado: {STATUS[active.status]}
          </p>
          {active.status === "PAST_DUE" && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">No hemos podido cobrar la renovación. Actualiza tu método de pago para no perder el acceso.</p>}
          <p className="mt-3 text-sm">
            {active.cancelAtPeriodEnd ? "Se cancelará" : "Próxima renovación"}: <strong>{formatDate(active.currentPeriodEnd)}</strong>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {active.cancelAtPeriodEnd ? (
              <Form action={resumeSubscriptionAction} className="space-y-2"><input type="hidden" name="id" value={active.id} /><Submit className="btn-primary">Reactivar renovación</Submit></Form>
            ) : (
              <Form action={cancelSubscriptionAction} className="space-y-2" confirm="¿Seguro que quieres cancelar? Mantendrás el acceso hasta el final del periodo pagado.">
                <input type="hidden" name="id" value={active.id} />
                <Submit className="btn-outline">Cancelar membresía</Submit>
              </Form>
            )}
            {me?.stripeCustomerId && (
              <form action={billingPortalAction}><button className="btn-outline">Método de pago y facturas</button></form>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm text-silver-600">No tienes ninguna membresía activa.</p>
          <Link href="/membresias" className="btn-primary mt-4">Ver membresías</Link>
        </div>
      )}
      {subs.filter((s) => s !== active).length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Membresía</th><th>Periodicidad</th><th>Estado</th><th>Desde</th></tr></thead>
            <tbody>
              {subs.filter((s) => s !== active).map((s) => (
                <tr key={s.id}><td>{s.plan.name}</td><td>{s.interval === "MONTH" ? "Mensual" : "Anual"}</td><td>{STATUS[s.status]}</td><td>{formatDate(s.createdAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
