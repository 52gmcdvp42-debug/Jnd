import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Section, STATUS_OPTIONS } from "@/components/admin/PageHeader";
import { Form, Submit, ActionButton } from "@/components/ui/Form";
import { Field, Select, TextArea, Checkbox } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ResourceManager } from "@/components/admin/ResourceManager";
import { VideoForm } from "@/components/admin/VideoForm";
import { deleteLessonAction, deleteQuestionAction, saveQuestionAction, updateLessonAction, updateQuizAction } from "@/app/actions/admin/content";
import { formatDuration } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/video";

function QuestionForm({ quizId, q }: { quizId: string; q?: { id: string; text: string; explanation: string | null; sortOrder: number; options: { text: string; isCorrect: boolean }[] } }) {
  const opts = [...(q?.options ?? []), ...Array.from({ length: Math.max(0, 6 - (q?.options.length ?? 0)) }, () => ({ text: "", isCorrect: false }))];
  return (
    <Form action={saveQuestionAction} resetOnSuccess={!q} className="space-y-3">
      <input type="hidden" name="quizId" value={quizId} />
      {q && <input type="hidden" name="id" value={q.id} />}
      <TextArea label="Pregunta" name="text" defaultValue={q?.text} rows={2} required />
      <div className="space-y-2">
        <p className="label">Opciones (marca las correctas)</p>
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" name={`correct_${i}`} defaultChecked={o.isCorrect} className="h-4 w-4 accent-emerald-600" aria-label={`Opción ${i + 1} correcta`} />
            <input name={`opt_${i}`} defaultValue={o.text} placeholder={`Opción ${i + 1}${i > 1 ? " (opcional)" : ""}`} className="input" />
          </div>
        ))}
      </div>
      <Field label="Explicación tras responder (opcional)" name="explanation" defaultValue={q?.explanation ?? ""} />
      <Field label="Orden" name="sortOrder" type="number" defaultValue={q?.sortOrder ?? 0} className="max-w-[120px]" />
      <Submit>{q ? "Guardar pregunta" : "Añadir pregunta"}</Submit>
    </Form>
  );
}

export default async function EditLesson({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      module: { include: { course: true } },
      video: true,
      resources: { orderBy: { sortOrder: "asc" } },
      quiz: { include: { questions: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } }, _count: { select: { attempts: true } } } },
    },
  });
  if (!lesson) notFound();
  const videos = await db.video.findMany({ orderBy: { createdAt: "desc" }, take: 500 });

  return (
    <>
      <PageHeader
        title={lesson.title}
        subtitle={<span className="flex items-center gap-2"><StatusBadge status={lesson.status} /> {lesson.module.course.title} › {lesson.module.title}</span>}
        back={{ href: `/admin/modulos/${lesson.moduleId}`, label: lesson.module.title }}
        actions={<Link href={`/aprender/${lesson.module.course.slug}/${lesson.id}`} target="_blank" className="btn-outline">Vista previa ↗</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Contenido de la lección">
            <Form action={updateLessonAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={lesson.id} />
              <Field label="Título" name="title" defaultValue={lesson.title} required className="sm:col-span-2" />
              <Select label="Tipo" name="type" defaultValue={lesson.type} options={[{ value: "VIDEO", label: "Vídeo" }, { value: "TEXT", label: "Texto / lectura" }, { value: "QUIZ", label: "Cuestionario / examen" }]} />
              <Select label="Estado" name="status" defaultValue={lesson.status} options={STATUS_OPTIONS} />
              <Select
                label="Vídeo"
                name="videoId"
                defaultValue={lesson.videoId ?? ""}
                className="sm:col-span-2"
                options={[{ value: "", label: "— Sin vídeo —" }, ...videos.map((v) => ({ value: v.id, label: `${v.title} · ${PROVIDER_LABEL[v.provider]}${v.durationSeconds ? ` · ${formatDuration(v.durationSeconds)}` : ""}` }))]}
                hint="Elige un vídeo de la biblioteca o añade uno nuevo en el panel de la derecha."
              />
              <TextArea label="Texto / notas de la lección" name="content" defaultValue={lesson.content ?? ""} rows={10} className="sm:col-span-2" hint="Formato: línea en blanco = párrafo · «## » = título · «- » = lista." />
              <Field label="Orden" name="sortOrder" type="number" defaultValue={lesson.sortOrder} />
              <div className="flex items-end"><Checkbox label="Vista previa gratuita" name="isFreePreview" defaultChecked={lesson.isFreePreview} hint="Visible sin comprar (curso publicado)." /></div>
              <div className="sm:col-span-2"><Submit>Guardar lección</Submit></div>
            </Form>
          </Section>

          {lesson.quiz && (
            <Section title="Cuestionario" description={`Las respuestas correctas se guardan y corrigen solo en el servidor. ${lesson.quiz._count.attempts} intentos realizados.`}>
              <Form action={updateQuizAction} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={lesson.quiz.id} />
                <Field label="Nota para aprobar (%)" name="passingScore" type="number" min={0} max={100} defaultValue={lesson.quiz.passingScore} />
                <Field label="Intentos máximos" name="maxAttempts" type="number" min={0} defaultValue={lesson.quiz.maxAttempts ?? 0} hint="0 = ilimitados" />
                <Checkbox label="Es una evaluación (cuenta para el certificado)" name="isExam" defaultChecked={lesson.quiz.isExam} />
                <Checkbox label="Mostrar corrección al alumno tras enviar" name="showAnswers" defaultChecked={lesson.quiz.showAnswers} />
                <div className="sm:col-span-2"><Submit>Guardar ajustes</Submit></div>
              </Form>
              <div className="mt-6 space-y-3">
                {lesson.quiz.questions.map((q, i) => (
                  <details key={q.id} className="rounded-lg border border-silver-300/60">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span><span className="text-electric">{i + 1}.</span> {q.text}</span>
                      <span className="text-xs text-silver-600">{q.options.filter((o) => o.isCorrect).length} correcta(s) ▾</span>
                    </summary>
                    <div className="border-t border-silver-300/50 p-4">
                      <QuestionForm quizId={lesson.quiz!.id} q={q} />
                      <div className="mt-3"><ActionButton action={deleteQuestionAction} hidden={{ id: q.id }} className="text-sm text-red-600 hover:underline" confirm="¿Eliminar esta pregunta?">Eliminar pregunta</ActionButton></div>
                    </div>
                  </details>
                ))}
              </div>
              <div className="mt-6 rounded-lg bg-snow p-4">
                <p className="mb-3 font-medium">Nueva pregunta</p>
                <QuestionForm quizId={lesson.quiz.id} />
              </div>
            </Section>
          )}

          <ResourceManager target="lesson" targetId={lesson.id} resources={lesson.resources} />
        </div>
        <div className="space-y-6">
          <Section title="Añadir vídeo a la biblioteca" description="Se enlazará automáticamente a esta lección.">
            <VideoForm attachToLesson={lesson.id} />
          </Section>
          <Section title="Zona peligrosa">
            <Form action={deleteLessonAction} confirm={`¿Eliminar la lección «${lesson.title}»? Se perderá el progreso de los alumnos en ella.`}>
              <input type="hidden" name="id" value={lesson.id} />
              <Submit className="btn-danger">Eliminar lección</Submit>
            </Form>
          </Section>
        </div>
      </div>
    </>
  );
}
