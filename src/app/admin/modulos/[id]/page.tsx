import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Section, STATUS_OPTIONS } from "@/components/admin/PageHeader";
import { Form, Submit } from "@/components/ui/Form";
import { Field, Select, TextArea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { createLessonAction, deleteModuleAction, updateModuleAction } from "@/app/actions/admin/content";
import { centsToInput, formatDuration } from "@/lib/format";

const TYPE = { VIDEO: "Vídeo", TEXT: "Texto", QUIZ: "Cuestionario" } as const;

export default async function EditModule({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const mod = await db.module.findUnique({
    where: { id },
    include: {
      course: true,
      lessons: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { video: true, quiz: { include: { _count: { select: { questions: true } } } } } },
      resources: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!mod) notFound();
  return (
    <>
      <PageHeader title={mod.title} subtitle={<span className="flex items-center gap-2"><StatusBadge status={mod.status} /> Módulo de «{mod.course.title}»</span>} back={{ href: `/admin/cursos/${mod.courseId}`, label: mod.course.title }} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Lecciones">
            {mod.lessons.length > 0 && (
              <ul className="mb-5 divide-y divide-silver-300/40 rounded-lg border border-silver-300/50">
                {mod.lessons.map((l, i) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-silver-600">{i + 1}</span>
                      <Link href={`/admin/lecciones/${l.id}`} className="font-medium hover:text-electric">{l.title}</Link>
                      <StatusBadge status={l.status} />
                      {l.isFreePreview && <span className="badge bg-electric-100 text-electric-600">Vista previa gratis</span>}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-silver-600">
                      {TYPE[l.type]}
                      {l.type === "VIDEO" && (l.video ? formatDuration(l.video.durationSeconds) || "vídeo enlazado" : <span className="text-amber-700">sin vídeo</span>)}
                      {l.type === "QUIZ" && `${l.quiz?._count.questions ?? 0} preguntas`}
                      <Link href={`/admin/lecciones/${l.id}`} className="btn-outline btn-sm">Editar</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Form action={createLessonAction} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" resetOnSuccess>
              <input type="hidden" name="moduleId" value={mod.id} />
              <Field label="Nueva lección" name="title" placeholder="Título de la lección" required />
              <Select label="Tipo" name="type" options={[{ value: "VIDEO", label: "Vídeo" }, { value: "TEXT", label: "Texto / lectura" }, { value: "QUIZ", label: "Cuestionario / examen" }]} />
              <Submit>Añadir</Submit>
            </Form>
          </Section>
          <ResourceManager target="module" targetId={mod.id} resources={mod.resources} />
        </div>
        <div className="space-y-6">
          <Section title="Ajustes del módulo">
            <Form action={updateModuleAction}>
              <input type="hidden" name="id" value={mod.id} />
              <Field label="Título" name="title" defaultValue={mod.title} required />
              <TextArea label="Descripción" name="description" defaultValue={mod.description ?? ""} rows={4} />
              <Select label="Estado" name="status" defaultValue={mod.status} options={STATUS_OPTIONS} />
              <Field label="Orden" name="sortOrder" type="number" defaultValue={mod.sortOrder} />
              <Field label="Precio del módulo suelto (€)" name="price" defaultValue={centsToInput(mod.priceCents)} placeholder="Ej.: 49,00" hint="Vacío = este módulo no se vende por separado." />
              <Submit>Guardar módulo</Submit>
            </Form>
          </Section>
          <Section title="Zona peligrosa">
            <Form action={deleteModuleAction} confirm={`¿Eliminar el módulo «${mod.title}» y todas sus lecciones?`}>
              <input type="hidden" name="id" value={mod.id} />
              <p className="text-sm text-silver-600">Elimina el módulo y sus lecciones. Bloqueado si tiene compras.</p>
              <Submit className="btn-danger">Eliminar módulo</Submit>
            </Form>
          </Section>
        </div>
      </div>
    </>
  );
}
