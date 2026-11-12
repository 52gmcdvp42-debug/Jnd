import Link from "next/link";
import { db } from "@/lib/db";
import { getGeneralSettings } from "@/lib/settings";
import { CourseCard } from "@/components/CourseCard";

export default async function HomePage() {
  const [s, categories, courses, plans] = await Promise.all([
    getGeneralSettings(),
    db.category.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 6, include: { category: true } }),
    db.membershipPlan.count({ where: { isActive: true } }),
  ]);

  return (
    <>
      <section className="bg-grid relative overflow-hidden bg-navy text-snow">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-electric/20 blur-3xl" />
        <div className="container-x relative py-20 sm:py-28 lg:py-32">
          <p className="font-display text-sm font-semibold tracking-[0.35em] text-electric">{s.slogan}</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{s.heroTitle}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-silver-300">{s.heroText}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/cursos" className="btn-primary px-6 py-3 text-base">Explorar formaciones</Link>
            {plans > 0 && <Link href="/membresias" className="btn-ghost-light px-6 py-3 text-base">Ver membresías</Link>}
          </div>
          <p className="mt-14 text-xs tracking-[0.35em] text-silver">{s.secondarySlogan}</p>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="container-x py-16 sm:py-20">
          <p className="eyebrow">Áreas de formación</p>
          <h2 className="mt-2 text-3xl font-bold">Aprende lo que mueve los mercados</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c, i) => (
              <Link key={c.id} href={`/cursos?categoria=${c.slug}`} className="card group p-5 transition hover:border-electric">
                <span className="font-display text-sm font-bold text-electric">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-semibold group-hover:text-electric">{c.name}</h3>
                {c.description && <p className="mt-1 text-sm text-silver-600">{c.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="border-y border-silver-300/50 bg-white">
        <div className="container-x grid gap-10 py-16 md:grid-cols-3">
          {[
            ["THINK", "Criterio propio", "Entiende el porqué de cada decisión financiera antes de tomarla."],
            ["LEARN", "Método y rigor", "Formaciones estructuradas en módulos y lecciones, a tu ritmo y desde cualquier dispositivo."],
            ["LEAD", "Gestión del riesgo", "Aprende a proteger tu capital y a desarrollar la mentalidad del inversor a largo plazo."],
          ].map(([k, t, d]) => (
            <div key={k}>
              <p className="font-display text-2xl font-extrabold tracking-[0.25em] text-navy">{k}<span className="text-electric">.</span></p>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-silver-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Catálogo</p>
            <h2 className="mt-2 text-3xl font-bold">Formaciones</h2>
          </div>
          {courses.length > 0 && <Link href="/cursos" className="text-sm font-semibold text-electric hover:underline">Ver todo el catálogo →</Link>}
        </div>
        {courses.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        ) : (
          <div className="card mt-10 p-10 text-center">
            <p className="font-display text-lg font-semibold">Próximamente</p>
            <p className="mt-2 text-sm text-silver-600">Estamos preparando las primeras formaciones. Crea tu cuenta para estar al día.</p>
            <Link href="/registro" className="btn-primary mt-6">Crear cuenta</Link>
          </div>
        )}
      </section>

      <section className="bg-navy">
        <div className="container-x flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-2xl font-bold text-snow sm:text-3xl">{s.secondarySlogan}</p>
            <p className="mt-2 text-silver-300">Empieza hoy tu formación con JND.</p>
          </div>
          <Link href="/registro" className="btn-primary px-6 py-3 text-base">Empezar ahora</Link>
        </div>
      </section>
    </>
  );
}
