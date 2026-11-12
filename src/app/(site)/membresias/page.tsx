import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/session";
import { BuyButton } from "@/components/BuyButton";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/access";

export const metadata = { title: "Membresías" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  const user = await getCurrentUser();
  const [plans, activeSub] = await Promise.all([
    db.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { includedCategories: { select: { name: true } }, includedCourses: { where: { status: "PUBLISHED" }, select: { title: true } } },
    }),
    user ? db.subscription.findFirst({ where: { userId: user.id, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } }, include: { plan: true } }) : null,
  ]);

  return (
    <>
      <section className="bg-grid bg-navy py-16 text-center text-snow">
        <div className="container-x">
          <p className="eyebrow">Membresías</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">Aprende sin límites</h1>
          <p className="mx-auto mt-4 max-w-2xl text-silver-300">Accede a las formaciones incluidas en tu nivel mientras tu membresía esté activa. Cancela cuando quieras desde tu área privada.</p>
          {pago === "cancelado" && <p className="mx-auto mt-6 max-w-md rounded-lg bg-white/10 px-4 py-2 text-sm">El pago se ha cancelado. No se ha realizado ningún cargo.</p>}
        </div>
      </section>
      <section className="container-x py-14">
        {activeSub && (
          <div className="card mx-auto mb-10 max-w-2xl p-5 text-center text-sm">
            Ya tienes la membresía <strong>{activeSub.plan.name}</strong> activa.{" "}
            <Link href="/cuenta/suscripcion" className="font-semibold text-electric hover:underline">Gestionar suscripción</Link>
          </div>
        )}
        {plans.length === 0 ? (
          <div className="card mx-auto max-w-xl p-10 text-center text-silver-600">Las membresías estarán disponibles próximamente.</div>
        ) : (
          <div className={`mx-auto grid max-w-5xl gap-6 ${plans.length > 1 ? "md:grid-cols-2" : ""} ${plans.length > 2 ? "lg:grid-cols-3" : ""}`}>
            {plans.map((p, i) => {
              const featured = i === plans.length - 1 && plans.length > 1;
              const savings = p.monthlyPriceCents && p.yearlyPriceCents ? Math.round((1 - p.yearlyPriceCents / (p.monthlyPriceCents * 12)) * 100) : 0;
              return (
                <div key={p.id} className={`flex flex-col rounded-2xl p-7 ${featured ? "bg-navy text-snow shadow-2xl ring-2 ring-electric" : "card"}`}>
                  <p className={`font-display text-sm font-bold uppercase tracking-[0.25em] ${featured ? "text-electric" : "text-electric"}`}>{p.name}</p>
                  {p.description && <p className={`mt-3 text-sm ${featured ? "text-silver-300" : "text-silver-600"}`}>{p.description}</p>}
                  <div className="mt-6 space-y-1">
                    {p.monthlyPriceCents ? <p><span className="font-display text-4xl font-bold">{formatPrice(p.monthlyPriceCents, p.currency)}</span><span className="text-sm opacity-70"> / mes</span></p> : null}
                    {p.yearlyPriceCents ? (
                      <p className="text-sm opacity-80">
                        o {formatPrice(p.yearlyPriceCents, p.currency)} / año{savings > 0 && <span className="ml-1 font-semibold text-electric">(ahorra {savings}%)</span>}
                      </p>
                    ) : null}
                  </div>
                  <ul className={`mt-6 flex-1 space-y-2 text-sm ${featured ? "text-silver-300" : "text-navy-600"}`}>
                    {p.includesAllCourses && <li>✓ Acceso a todo el catálogo</li>}
                    {!p.includesAllCourses && p.includedCategories.map((c) => <li key={c.name}>✓ Categoría: {c.name}</li>)}
                    {!p.includesAllCourses && p.includedCourses.map((c) => <li key={c.title}>✓ {c.title}</li>)}
                    {p.benefits.map((b) => <li key={b}>✓ {b}</li>)}
                    {p.allowCertificates && <li>✓ Certificados de finalización</li>}
                    {p.allowDownloads && <li>✓ Materiales descargables</li>}
                  </ul>
                  {!activeSub && (
                    <div className="mt-7 space-y-2">
                      {p.monthlyPriceCents ? <BuyButton kind="plan" id={p.id} interval="MONTH" back="/membresias" className={featured ? "btn-primary w-full" : "btn-dark w-full"}>Suscripción mensual</BuyButton> : null}
                      {p.yearlyPriceCents ? <BuyButton kind="plan" id={p.id} interval="YEAR" back="/membresias" className={featured ? "btn-ghost-light w-full" : "btn-outline w-full"}>Suscripción anual</BuyButton> : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-silver-600">Renovación automática al final de cada periodo. Puedes cancelar en cualquier momento y conservarás el acceso hasta el final del periodo pagado. Pagos procesados de forma segura por Stripe.</p>
      </section>
    </>
  );
}
