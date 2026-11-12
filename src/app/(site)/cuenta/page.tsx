import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccessProfile } from "@/lib/access-server";
import { studentCourses } from "@/lib/student";
import { formatDate } from "@/lib/format";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/access";

export const metadata = { title: "Mi área" };

export default async function AccountHome() {
  const user = await requireUser("/cuenta");
  const profile = await getAccessProfile();
  const [courses, me, sub] = await Promise.all([
    studentCourses(user.id, profile),
    db.user.findUnique({ where: { id: user.id }, select: { lastLessonId: true, lastLessonAt: true } }),
    db.subscription.findFirst({ where: { userId: user.id, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } }, include: { plan: true } }),
  ]);
  const last = me?.lastLessonId
    ? await db.lesson.findUnique({ where: { id: me.lastLessonId }, include: { module: { include: { course: true } } } })
    : null;
  const lastProgress = last ? await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: last.id } } }) : null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Mis cursos</h1>

      {last && last.status === "PUBLISHED" && (
        <Link href={`/aprender/${last.module.course.slug}/${last.id}`} className="block overflow-hidden rounded-2xl bg-navy p-6 text-snow transition hover:ring-2 hover:ring-electric">
          <p className="eyebrow">Continuar donde lo dejaste</p>
          <p className="mt-2 text-lg font-semibold">{last.title}</p>
          <p className="text-sm text-silver-300">{last.module.course.title} · {last.module.title}</p>
          {lastProgress && lastProgress.positionSeconds > 0 && !lastProgress.completedAt && (
            <p className="mt-2 text-xs text-silver">Reanudar en {Math.floor(lastProgress.positionSeconds / 60)}:{String(lastProgress.positionSeconds % 60).padStart(2, "0")}</p>
          )}
          <span className="btn-primary mt-4">Reanudar ▶</span>
        </Link>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
        {sub ? (
          <span>Membresía <strong>{sub.plan.name}</strong> activa{sub.currentPeriodEnd && ` · ${sub.cancelAtPeriodEnd ? "finaliza" : "se renueva"} el ${formatDate(sub.currentPeriodEnd)}`}</span>
        ) : (
          <span className="text-silver-600">No tienes ninguna membresía activa.</span>
        )}
        <Link href={sub ? "/cuenta/suscripcion" : "/membresias"} className="font-semibold text-electric hover:underline">{sub ? "Gestionar" : "Ver membresías"}</Link>
      </div>

      {courses.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">Todavía no tienes formaciones</p>
          <p className="mt-1 text-sm text-silver-600">Explora el catálogo y empieza a aprender.</p>
          <Link href="/cursos" className="btn-primary mt-5">Ver catálogo</Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map(({ course, full, ownedModules, percent, completed, total }) => (
            <div key={course.id} className="card flex flex-col p-5">
              <p className="eyebrow">{course.category?.name ?? "Formación"}</p>
              <h2 className="mt-1 font-semibold">{course.title}</h2>
              <p className="mt-1 text-xs text-silver-600">
                {full ? "Curso completo" : `Módulos adquiridos: ${ownedModules.map((m) => m.title).join(", ")}`}
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-snow"><div className="h-full bg-electric" style={{ width: `${percent}%` }} /></div>
              <p className="mt-1 text-xs text-silver-600">{percent}% · {completed}/{total} lecciones</p>
              <Link href={`/aprender/${course.slug}`} className="btn-dark mt-4 self-start">{completed ? "Continuar" : "Empezar"}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
