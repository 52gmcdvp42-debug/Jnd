import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccessProfile } from "@/lib/access-server";
import { canDownloadIn, canViewLesson, courseVisible, hasModuleAccess } from "@/lib/access";
import { certificateStatus, publishedCourseTree } from "@/lib/learning";
import { formatDuration } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { VideoPlayer } from "@/components/VideoPlayer";
import { QuizForm } from "@/components/QuizForm";
import { RichText } from "@/components/RichText";
import { toggleCompleteAction, claimCertificateAction } from "@/app/actions/learning";

export const metadata = { robots: { index: false } };

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const user = await getCurrentUser();
  const profile = await getAccessProfile();
  const course = await db.course.findUnique({ where: { slug } });
  if (!course || !courseVisible(profile, course)) notFound();

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: true,
      video: true,
      resources: { orderBy: { sortOrder: "asc" } },
      quiz: { include: { questions: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true } } } } } },
    },
  });
  if (!lesson || lesson.module.courseId !== course.id) notFound();
  const lessonRef = { ...lesson, module: { ...lesson.module, course } };
  if (!canViewLesson(profile, lessonRef)) {
    if (!user) redirect(`/entrar?next=/aprender/${slug}/${lessonId}`);
    redirect(`/cursos/${slug}`);
  }

  const modules = await publishedCourseTree(course.id);
  const flat = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
  const idx = flat.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  const progress = user ? await db.lessonProgress.findMany({ where: { userId: user.id, lessonId: { in: flat.map((l) => l.id) } } }) : [];
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const percent = flat.length ? Math.floor((done.size / flat.length) * 100) : 0;
  const isDone = done.has(lesson.id);

  const moduleResources = await db.resource.findMany({ where: { moduleId: lesson.moduleId }, orderBy: { sortOrder: "asc" } });
  const canDownload = canDownloadIn(profile, course, lesson.moduleId) || lesson.isFreePreview;
  const resources = [...lesson.resources, ...moduleResources].filter((r) => r.isPublic || canDownload);

  let attemptsLeft: number | null = null;
  let bestScore: number | null = null;
  if (lesson.quiz && user) {
    const attempts = await db.quizAttempt.findMany({ where: { quizId: lesson.quiz.id, userId: user.id }, select: { score: true } });
    bestScore = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
    if (lesson.quiz.maxAttempts) attemptsLeft = Math.max(0, lesson.quiz.maxAttempts - attempts.length);
  }

  const cert = user && course.certificateEnabled ? await certificateStatus(profile, user.id, course.id) : null;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="order-2 border-white/10 bg-navy lg:order-1 lg:h-screen lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r">
        <div className="hidden border-b border-white/10 p-5 lg:block">
          <Link href="/cuenta"><Logo /></Link>
        </div>
        <div className="border-b border-white/10 p-5">
          <Link href={`/cursos/${course.slug}`} className="text-xs text-silver hover:text-white">← Ficha del curso</Link>
          <h2 className="mt-2 font-semibold leading-snug">{course.title}</h2>
          {user && (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-electric" style={{ width: `${percent}%` }} /></div>
              <p className="mt-1.5 text-xs text-silver">{percent}% completado</p>
            </>
          )}
        </div>
        <nav className="pb-10">
          {modules.map((m, mi) => {
            const modAccess = hasModuleAccess(profile, { ...m, course });
            return (
              <div key={m.id} className="border-b border-white/5">
                <p className="px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-silver">Módulo {mi + 1} · {m.title}</p>
                <ul>
                  {m.lessons.map((l) => {
                    const allowed = modAccess || l.isFreePreview;
                    const current = l.id === lesson.id;
                    const content = (
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${done.has(l.id) ? "border-electric bg-electric text-white" : "border-silver/50"}`}>{done.has(l.id) ? "✓" : ""}</span>
                        <span className="flex-1">{l.title}</span>
                        {!allowed && <span className="text-xs">🔒</span>}
                        {allowed && l.video?.durationSeconds ? <span className="text-xs text-silver">{formatDuration(l.video.durationSeconds)}</span> : null}
                      </span>
                    );
                    return (
                      <li key={l.id}>
                        {allowed ? (
                          <Link href={`/aprender/${course.slug}/${l.id}`} className={`block px-5 py-2.5 text-sm ${current ? "bg-electric/15 text-white" : "text-silver-300 hover:bg-white/5"}`}>{content}</Link>
                        ) : (
                          <span className="block px-5 py-2.5 text-sm text-silver/60">{content}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="order-1 flex-1 lg:order-2 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 lg:hidden">
          <Link href="/cuenta"><Logo /></Link>
          <Link href="/cuenta" className="text-sm text-silver-300">Mi área</Link>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
          {lesson.status !== "PUBLISHED" && <p className="mb-4 rounded bg-amber-500/20 px-3 py-2 text-sm text-amber-200">Vista previa del equipo: esta lección no está publicada.</p>}
          {lesson.type === "VIDEO" && (lesson.video ? <VideoPlayer lessonId={lesson.id} trackProgress={!!user} /> : (
            <div className="flex aspect-video items-center justify-center rounded-xl bg-navy text-sm text-silver">Vídeo disponible próximamente.</div>
          ))}

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-silver">{lesson.module.title}</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{lesson.title}</h1>
            </div>
            {user && lesson.type !== "QUIZ" && (
              <form action={toggleCompleteAction}>
                <input type="hidden" name="lessonId" value={lesson.id} />
                <button className={isDone ? "btn-ghost-light" : "btn-primary"}>{isDone ? "✓ Completada" : "Marcar como completada"}</button>
              </form>
            )}
          </div>

          {lesson.content && (
            <div className="mt-6 rounded-xl bg-white p-6 text-navy">
              <RichText text={lesson.content} />
            </div>
          )}

          {lesson.type === "QUIZ" && lesson.quiz && (
            <div className="mt-6 rounded-xl bg-white p-6 text-navy">
              <h2 className="text-lg font-semibold">{lesson.quiz.isExam ? "Evaluación" : "Cuestionario"}</h2>
              {bestScore != null && <p className="mt-1 text-sm text-silver-600">Tu mejor nota: <strong>{bestScore}%</strong></p>}
              <div className="mt-4">
                {!user ? (
                  <Link href={`/entrar?next=/aprender/${slug}/${lessonId}`} className="btn-primary">Inicia sesión para responder</Link>
                ) : attemptsLeft === 0 ? (
                  <p className="text-sm">Has agotado los intentos de este cuestionario.</p>
                ) : (
                  <QuizForm lessonId={lesson.id} questions={lesson.quiz.questions.map((q) => ({ id: q.id, text: q.text, multiple: q.multiple, options: q.options }))} passingScore={lesson.quiz.passingScore} attemptsLeft={attemptsLeft} />
                )}
              </div>
            </div>
          )}

          {resources.length > 0 && (
            <div className="mt-6 rounded-xl border border-white/10 p-5">
              <h2 className="font-semibold">Materiales</h2>
              <ul className="mt-3 divide-y divide-white/10">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      {r.title}
                      {r.description && <span className="block text-xs text-silver">{r.description}</span>}
                    </span>
                    <a href={`/api/resources/${r.id}/download`} className="btn-ghost-light btn-sm" rel="noopener">{r.externalUrl ? "Abrir" : "Descargar"}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cert && (
            <div className="mt-6 rounded-xl border border-electric/40 bg-electric/10 p-5 text-sm">
              <p className="font-semibold">Certificado del curso</p>
              {cert.existing && !cert.existing.revokedAt ? (
                <p className="mt-1">¡Enhorabuena! <a className="font-semibold text-electric-400 underline" href={`/api/certificates/${cert.existing.code}/pdf`}>Descargar certificado</a></p>
              ) : cert.evaluation.eligible ? (
                <form action={claimCertificateAction} className="mt-2"><input type="hidden" name="courseId" value={course.id} /><button className="btn-primary btn-sm">Obtener certificado</button></form>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-silver-300">{cert.evaluation.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-between gap-3 border-t border-white/10 pt-6">
            {prev ? <Link href={`/aprender/${slug}/${prev.id}`} className="btn-ghost-light">← Anterior</Link> : <span />}
            {next ? <Link href={`/aprender/${slug}/${next.id}`} className="btn-primary">Siguiente →</Link> : <span />}
          </div>
        </div>
      </main>
    </div>
  );
}
