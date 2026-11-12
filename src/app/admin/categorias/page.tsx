import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Section, STATUS_OPTIONS } from "@/components/admin/PageHeader";
import { Form, Submit, ActionButton } from "@/components/ui/Form";
import { Field, Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { saveCategoryAction, deleteCategoryAction } from "@/app/actions/admin/content";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  await requireStaff();
  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { courses: true } } } });
  return (
    <>
      <PageHeader title="Categorías" subtitle="Áreas temáticas que organizan el catálogo. Puedes añadir nuevas en cualquier momento." />
      <div className="space-y-4">
        {categories.map((c) => (
          <details key={c.id} className="card group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <span className="flex items-center gap-3">
                <span className="w-8 text-xs text-silver-600">#{c.sortOrder}</span>
                <span className="font-medium">{c.name}</span>
                <StatusBadge status={c.status} />
              </span>
              <span className="text-xs text-silver-600">{c._count.courses} cursos · Editar ▾</span>
            </summary>
            <div className="border-t border-silver-300/50 p-4">
              <Form action={saveCategoryAction} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                <Field label="Nombre" name="name" defaultValue={c.name} required />
                <Field label="Slug (URL)" name="slug" defaultValue={c.slug} hint="Se usa en la dirección web. Solo minúsculas y guiones." />
                <Field label="Descripción" name="description" defaultValue={c.description ?? ""} className="sm:col-span-2" />
                <Select label="Estado" name="status" defaultValue={c.status} options={STATUS_OPTIONS} />
                <Field label="Orden" name="sortOrder" type="number" defaultValue={c.sortOrder} />
                <div className="flex gap-2 sm:col-span-2">
                  <Submit>Guardar</Submit>
                </div>
              </Form>
              {c._count.courses === 0 && (
                <div className="mt-3"><ActionButton action={deleteCategoryAction} hidden={{ id: c.id }} className="btn-sm text-red-600 hover:underline" confirm={`¿Eliminar la categoría «${c.name}»?`}>Eliminar categoría</ActionButton></div>
              )}
            </div>
          </details>
        ))}
      </div>
      <Section title="Nueva categoría" className="mt-6">
        <Form action={saveCategoryAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
          <Field label="Nombre" name="name" required />
          <Field label="Orden" name="sortOrder" type="number" defaultValue={(categories.at(-1)?.sortOrder ?? 0) + 10} />
          <Field label="Descripción" name="description" className="sm:col-span-2" />
          <Select label="Estado" name="status" defaultValue="PUBLISHED" options={STATUS_OPTIONS} />
          <div className="flex items-end"><Submit>Crear categoría</Submit></div>
        </Form>
      </Section>
    </>
  );
}
