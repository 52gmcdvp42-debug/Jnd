import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { PlanForm } from "@/components/admin/PlanForm";
import { Badge } from "@/components/ui/StatusBadge";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Membresías" };

export default async function PlansAdmin() {
  await requireAdmin();
  const [plans, courses, categories] = await Promise.all([
    db.membershipPlan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } } } } } } }),
    db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Membresías" subtitle="Niveles de suscripción mensual y anual. Puedes crear tantos niveles como necesites." />
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <Link key={p.id} href={`/admin/membresias/${p.id}`} className="card p-5 transition hover:border-electric">
            <div className="flex items-center justify-between"><h2 className="font-semibold">{p.name}</h2>{p.isActive ? <Badge tone="green">A la venta</Badge> : <Badge>No disponible</Badge>}</div>
            <p className="mt-2 text-sm text-silver-600">{formatPrice(p.monthlyPriceCents)} / mes · {formatPrice(p.yearlyPriceCents)} / año</p>
            <p className="mt-1 text-sm text-silver-600">{p._count.subscriptions} suscriptores activos</p>
          </Link>
        ))}
      </div>
      <Section title="Nuevo nivel de membresía" className="mt-6">
        <PlanForm courses={courses.map((c) => ({ id: c.id, name: c.title }))} categories={categories} />
      </Section>
    </>
  );
}
