import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAccessProfile } from "@/lib/access-server";
import { courseVisible, coveringPlans, hasFullCourseAccess, hasModuleAccess, planCoversCourse } from "@/lib/access";
import { publishedCourseTree } from "@/lib/learning";
import { formatDuration, formatPrice, LEVEL_LABEL } from "@/lib/format";
import { publicFileUrl } from "@/lib/storage";
import { RichText } from "@/components/RichText";
import { BuyButton } from "@/components/BuyButton";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await db.course.findUnique({ where: { slug }, select: { title: true, subtitle: true, status: true } });
  return c && c.status !== "DRAFT" ? { title: c.title, description: c.subtitle ?? undefined } : { title: "Curso" };
}

export default async function CoursePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pago?: string }> }) {
  const { slug } = await params;
  const { pago } = await searchParams;
  const profile = await getAccessProfile();
  const course = await db.course.findUnique({ where: { slug }, include: { category: true } });
  if (!course || !courseVisible(profile, course)) notFound();

  const modules = await publishedCourseTree(course.id);
  const full = hasFullCourseAccess(profile, course);
  const ownedModules = modules.filter((m) => hasModuleAccess(profile, { ...m, course }));
  if (course.status === "HIDDEN" && !full && ownedModules.length === 0 && !profile.isStaff) notFound();

  const plans = await db.membershipPlan.findMany({
    where: { isActive: true },
    include: { includedCourses: { select: { id: true } }, includedCategories: { select: { id: true } } },
    orderBy: { sortOrder: "asc" },
  });
  const plansIncluding = plans.filter((p) =>
    planCoversCourse(
      { ...p, courseIds: new Set(p.includedCourses.map((c) => c.id)), categoryIds: new Set(p.includedCategories.map((c) => c.id)) },
      course,
    ),
  );
  const lessonsCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const totalSeconds = modules.reduce((n, m) => n + m.lessons.reduce((s, l) => s + (l.video?.durationSeconds ?? 0), 0), 0);
  const cover = publicFileUrl(course.coverImageKey);
  const viaPlan = coveringPlans(profile, course);
  const back = `/cursos/${course.slug}`;

  return (
    <>
      {course.status !== "PUBLISHED" && (
        <div className="bg-amber-100 py-2 text-center text-sm text-amber-900">Vista previa del equipo · Este curso está en estado «{course.status === "DRAFT" ? "Borrador" : "Oculto"}»</div>
      )}
      <section className="bg-grid bg-navy text-snow">
        <div className="container-x grid gap-10 py-14 lg:grid-cols-5 lg:py-20">
          <div className="lg:col-span-3">
            <Link href={course.category ? `/cursos?categoria=${course.category.slug}` : "/cursos"} className="eyebrow hover:underline">
              {course.category?.name ?? "Catálogo"}
            </Link>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{course.title}</h1>
            {course.subtitle && <p className="mt-4 text-lg text-silver-300">{course.subtitle}</p>}
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-silver-300">
              <span>Nivel: {LEVEL_LABEL[course.level]}</span>
              <span>{modules.length} módulos · {lessonsCount} lecciones</span>
              {totalSeconds > 0 && <span>{formatDuration(totalSeconds)} de vídeo</span>}
              {course.certificateEnabled && <span>Con certificado</span>}
            </div>
            {pago === "cancelado" && <p className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm">El pago se ha cancelado. No se ha realizado ningún cargo.</p>}
          </div>
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl bg-white text-navy shadow-2xl">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="aspect-video w-full object-cover" />
              )}
              <div className="space-y-3 p-6">
                {full ? (
                  <>
                    <p className="text-sm font-medium text-emerald-700">✓ Tienes acceso completo{viaPlan.length ? ` con tu membresía ${viaPlan[0].name}` : ""}.</p>
                    <Link href={`/aprender/${course.slug}`} className="btn-primary w-full">Ir al curso</Link>
                  </>
                ) : (
                  <>
                    {ownedModules.length > 0 && (
                      <Link href={`/aprender/${course.slug}`} className="btn-dark w-full">Continuar con mis módulos</Link>
                    )}
                    {course.priceCents ? (
                      <>
                        <p className="font-display text-3xl font-bold">{formatPrice(course.priceCents, course.currency)}</p>
                        <BuyButton kind="course" id={course.id} back={back}>Comprar curso completo</BuyButton>
                      </>
                    ) : null}
                    {plansIncluding.length > 0 && (
                      <div className="rounded-lg bg-snow p-3 text-sm">
                        Incluido en {plansIncluding.length > 1 ? "las membresías" : "la membresía"}{" "}
                        <strong>{plansIncluding.map((p) => p.name).join(", ")}</strong>.{" "}
                        <Link href="/membresias" className="font-semibold text-electric hover:underline">Ver membresías</Link>
                      </div>
                    )}
                    {!course.priceCents && plansIncluding.length === 0 && modules.every((m) => !m.priceCents) && (
                      <p className="text-sm text-silver-600">Disponible próximamente.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-x grid gap-12 py-14 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {course.description && (
            <>
              <h2 className="text-2xl font-bold">Sobre esta formación</h2>
              <RichText text={course.description} className="prose-jnd mt-4" />
            </>
          )}
          <h2 className="mt-10 text-2xl font-bold">Contenido</h2>
          <div className="mt-5 space-y-4">
            {modules.length === 0 && <p className="text-silver-600">El temario se publicará próximamente.</p>}
            {modules.map((m, i) => {
              const owned = full || ownedModules.some((o) => o.id === m.id);
              return (
                <div key={m.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-silver-600">Módulo {i + 1}</p>
                      <h3 className="mt-1 font-semibold">{m.title}</h3>
                      {m.description && <p className="mt-1 text-sm text-silver-600">{m.description}</p>}
                    </div>
                    {owned ? (
                      <span className="badge bg-emerald-100 text-emerald-800">Acceso</span>
                    ) : m.priceCents ? (
                      <div className="w-full sm:w-auto">
                        <BuyButton kind="module" id={m.id} back={back} className="btn-outline btn-sm w-full sm:w-auto">
                          Comprar módulo · {formatPrice(m.priceCents, course.currency)}
                        </BuyButton>
                      </div>
                    ) : null}
                  </div>
                  {m.lessons.length > 0 && (
                    <ul className="divide-y divide-silver-300/40 border-t border-silver-300/40 text-sm">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="text-silver">{l.type === "VIDEO" ? "▶" : l.type === "QUIZ" ? "✎" : "≡"}</span>
                            {owned || l.isFreePreview ? (
                              <Link href={`/aprender/${course.slug}/${l.id}`} className="truncate hover:text-electric">{l.title}</Link>
                            ) : (
                              <span className="truncate">{l.title}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-silver-600">
                            {l.isFreePreview && !owned ? <span className="font-semibold text-electric">Vista previa</span> : formatDuration(l.video?.durationSeconds)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <aside className="lg:col-span-2">
          <div className="card p-6 text-sm text-silver-600">
            <h3 className="font-semibold text-navy">Formas de acceso</h3>
            <ul className="mt-3 space-y-2">
              <li>• Compra el curso completo con acceso a todos sus módulos.</li>
              <li>• O compra solo los módulos que te interesen.</li>
              <li>• O accede con una membresía que incluya este curso.</li>
            </ul>
            <p className="mt-4 text-xs">Contenido educativo. No constituye asesoramiento financiero.</p>
          </div>
        </aside>
      </section>
    </>
  );
}
