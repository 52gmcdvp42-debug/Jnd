import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Section, STATUS_OPTIONS } from "@/components/admin/PageHeader";
import { Form, Submit } from "@/components/ui/Form";
import { Field, Select, TextArea, Checkbox } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { createModuleAction, deleteCourseAction, updateCourseAction, uploadCoverAction } from "@/app/actions/admin/content";
import { centsToInput, formatPrice } from "@/lib/format";
import { publicFileUrl } from "@/lib/storage";

export default async function EditCourse({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      modules: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { lessons: true } } } },
      resources: { orderBy: { sortOrder: "asc" } },
      _count: { select: { entitlements: true, certificates: true } },
    },
  });
  if (!course) notFound();
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  const cover = publicFileUrl(course.coverImageKey);

  return (
    <>
      <PageHeader
        title={course.title}
        subtitle={<span className="flex items-center gap-2"><StatusBadge status={course.status} /> {course._count.entitlements} accesos · {course._count.certificates} certificados</span>}
        back={{ href: "/admin/cursos", label: "Cursos" }}
        actions={<Link href={`/cursos/${course.slug}`} className="btn-outline" target="_blank">Vista previa ↗</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Información del curso">
            <Form action={updateCourseAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={course.id} />
              <Field label="Título" name="title" defaultValue={course.title} required className="sm:col-span-2" />
              <Field label="Subtítulo" name="subtitle" defaultValue={course.subtitle ?? ""} className="sm:col-span-2" />
              <TextArea label="Descripción" name="description" defaultValue={course.description ?? ""} rows={8} className="sm:col-span-2" hint="Formato: línea en blanco = nuevo párrafo · «## » = título · «- » = lista." />
              <Select label="Categoría" name="categoryId" defaultValue={course.categoryId ?? ""} options={[{ value: "", label: "Sin categoría" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
              <Select label="Nivel" name="level" defaultValue={course.level} options={[{ value: "BEGINNER", label: "Inicial" }, { value: "INTERMEDIATE", label: "Intermedio" }, { value: "ADVANCED", label: "Avanzado" }]} />
              <Select label="Estado" name="status" defaultValue={course.status} options={STATUS_OPTIONS} hint="Oculto: no aparece en el catálogo, pero quien ya lo compró conserva el acceso." />
              <Field label="Orden en catálogo" name="sortOrder" type="number" defaultValue={course.sortOrder} />
              <Field label="Slug (URL)" name="slug" defaultValue={course.slug} className="sm:col-span-2" hint={`/cursos/${course.slug}`} />

              <div className="border-t border-silver-300/50 pt-4 sm:col-span-2"><p className="font-semibold">Venta</p></div>
              <Field label="Precio del curso completo (€)" name="price" defaultValue={centsToInput(course.priceCents)} placeholder="Ej.: 197,00" hint="Vacío = no se vende el curso completo por separado (p. ej., solo con membresía o por módulos)." />

              <div className="border-t border-silver-300/50 pt-4 sm:col-span-2"><p className="font-semibold">Certificado</p></div>
              <div className="sm:col-span-2"><Checkbox label="Emitir certificado al completar el curso" name="certificateEnabled" defaultChecked={course.certificateEnabled} /></div>
              <Field label="Progreso mínimo (%)" name="certMinProgress" type="number" min={0} max={100} defaultValue={course.certMinProgress} />
              <Field label="Nota media mínima en evaluaciones" name="certMinScore" type="number" min={0} max={100} defaultValue={course.certMinScore} />
              <div className="sm:col-span-2"><Checkbox label="Exigir aprobar todas las evaluaciones" name="certRequireAllQuizzes" defaultChecked={course.certRequireAllQuizzes} hint="Solo cuentan los cuestionarios marcados como «Evaluación»." /></div>
              <div className="sm:col-span-2"><Submit>Guardar curso</Submit></div>
            </Form>
          </Section>

          <Section title="Módulos" description="Cada módulo puede venderse por separado si le asignas precio.">
            {course.modules.length > 0 && (
              <ul className="mb-5 divide-y divide-silver-300/40 rounded-lg border border-silver-300/50">
                {course.modules.map((m, i) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-silver-600">{i + 1}</span>
                      <Link href={`/admin/modulos/${m.id}`} className="font-medium hover:text-electric">{m.title}</Link>
                      <StatusBadge status={m.status} />
                    </span>
                    <span className="flex items-center gap-3 text-xs text-silver-600">
                      {m._count.lessons} lecciones · {m.priceCents ? formatPrice(m.priceCents, course.currency) : "sin venta suelta"}
                      <Link href={`/admin/modulos/${m.id}`} className="btn-outline btn-sm">Editar</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Form action={createModuleAction} className="flex flex-col gap-3 sm:flex-row sm:items-end" resetOnSuccess>
              <input type="hidden" name="courseId" value={course.id} />
              <Field label="Nuevo módulo" name="title" placeholder="Título del módulo" required className="flex-1" />
              <Submit>Añadir módulo</Submit>
            </Form>
          </Section>

          <ResourceManager target="course" targetId={course.id} resources={course.resources} />
        </div>

        <div className="space-y-6">
          <Section title="Portada">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="mb-4 aspect-video w-full rounded-lg object-cover" />
            ) : (
              <div className="bg-grid mb-4 flex aspect-video items-center justify-center rounded-lg bg-navy text-xs text-silver">Sin portada</div>
            )}
            <Form action={uploadCoverAction} className="space-y-3">
              <input type="hidden" name="id" value={course.id} />
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" required className="input text-xs" />
              <p className="hint">JPG, PNG o WebP · 1600×900 recomendado · máx. 5 MB.</p>
              <Submit pendingText="Subiendo…">Subir portada</Submit>
            </Form>
          </Section>
          <Section title="Zona peligrosa">
            <p className="text-sm text-silver-600">Eliminar borra el curso con sus módulos, lecciones y materiales. Si tiene compras o certificados no se permite: usa «Oculto».</p>
            <Form action={deleteCourseAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={course.id} />
              <Field label="Escribe ELIMINAR para confirmar" name="confirm" autoComplete="off" />
              <Submit className="btn-danger" pendingText="Eliminando…">Eliminar curso</Submit>
            </Form>
          </Section>
        </div>
      </div>
    </>
  );
}
