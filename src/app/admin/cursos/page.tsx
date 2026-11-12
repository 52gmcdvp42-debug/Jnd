import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { Form, Submit } from "@/components/ui/Form";
import { Field, Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createCourseAction } from "@/app/actions/admin/content";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Cursos" };

export default async function AdminCourses() {
  await requireStaff();
  const [courses, categories] = await Promise.all([
    db.course.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: { category: true, _count: { select: { modules: true, entitlements: true } } } }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Cursos" subtitle="Academia → Categorías → Cursos → Módulos → Lecciones" />
      <div className="card overflow-x-auto">
        {courses.length === 0 ? (
          <p className="p-8 text-center text-sm text-silver-600">Aún no hay cursos. Crea el primero abajo; nacerá como borrador y no será visible hasta que lo publiques.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Curso</th><th>Categoría</th><th>Módulos</th><th>Precio</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium"><Link href={`/admin/cursos/${c.id}`} className="hover:text-electric">{c.title}</Link></td>
                  <td>{c.category?.name ?? "—"}</td>
                  <td>{c._count.modules}</td>
                  <td>{c.priceCents ? formatPrice(c.priceCents, c.currency) : "—"}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-right"><Link href={`/admin/cursos/${c.id}`} className="btn-outline btn-sm">Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Section title="Nuevo curso" className="mt-6">
        <Form action={createCourseAction} className="grid gap-4 sm:grid-cols-3">
          <Field label="Título" name="title" required className="sm:col-span-2" />
          <Select label="Categoría" name="categoryId" options={[{ value: "", label: "Sin categoría" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
          <div><Submit>Crear curso (borrador)</Submit></div>
        </Form>
      </Section>
    </>
  );
}
