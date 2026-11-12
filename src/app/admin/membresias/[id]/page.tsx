import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { PlanForm } from "@/components/admin/PlanForm";
import { Form, Submit } from "@/components/ui/Form";
import { deletePlanAction } from "@/app/actions/admin/commerce";

export default async function EditPlan({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const plan = await db.membershipPlan.findUnique({ where: { id }, include: { includedCourses: { select: { id: true } }, includedCategories: { select: { id: true } }, _count: { select: { subscriptions: true } } } });
  if (!plan) notFound();
  const [courses, categories] = await Promise.all([
    db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title={`Membresía ${plan.name}`} subtitle={`${plan._count.subscriptions} suscripciones registradas`} back={{ href: "/admin/membresias", label: "Membresías" }} />
      <div className="space-y-6">
        <Section title="Configuración" description="Los cambios de precio se aplican a las nuevas suscripciones; los suscriptores actuales mantienen su precio en Stripe.">
          <PlanForm plan={plan} courses={courses.map((c) => ({ id: c.id, name: c.title }))} categories={categories} courseIds={plan.includedCourses.map((c) => c.id)} categoryIds={plan.includedCategories.map((c) => c.id)} />
        </Section>
        {plan._count.subscriptions === 0 && (
          <Section title="Zona peligrosa">
            <Form action={deletePlanAction} confirm="¿Eliminar esta membresía?"><input type="hidden" name="id" value={plan.id} /><Submit className="btn-danger">Eliminar membresía</Submit></Form>
          </Section>
        )}
      </div>
    </>
  );
}
