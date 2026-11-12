import Link from "next/link";
import { db } from "@/lib/db";
import { CourseCard } from "@/components/CourseCard";

export const metadata = { title: "Cursos" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const { categoria, q } = await searchParams;
  const categories = await db.category.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const active = categories.find((c) => c.slug === categoria);
  const query = q?.trim().slice(0, 100);
  const courses = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      ...(active ? { categoryId: active.id } : {}),
      ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { subtitle: { contains: query, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { category: true },
  });

  return (
    <>
      <section className="bg-grid bg-navy py-14 text-snow">
        <div className="container-x">
          <p className="eyebrow">Catálogo</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{active ? active.name : "Todas las formaciones"}</h1>
          {active?.description && <p className="mt-2 max-w-2xl text-silver-300">{active.description}</p>}
          <form className="mt-6 flex max-w-md gap-2" action="/cursos">
            {active && <input type="hidden" name="categoria" value={active.slug} />}
            <input name="q" defaultValue={query} placeholder="Buscar formación…" className="input border-white/10 bg-white/10 text-snow placeholder:text-silver" />
            <button className="btn-primary">Buscar</button>
          </form>
        </div>
      </section>
      <section className="container-x py-10">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          <Link href="/cursos" className={`badge whitespace-nowrap px-4 py-2 text-sm ${!active ? "bg-navy text-snow" : "bg-white text-navy ring-1 ring-silver-300"}`}>Todas</Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/cursos?categoria=${c.slug}`} className={`badge whitespace-nowrap px-4 py-2 text-sm ${active?.id === c.id ? "bg-navy text-snow" : "bg-white text-navy ring-1 ring-silver-300"}`}>
              {c.name}
            </Link>
          ))}
        </div>
        {courses.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        ) : (
          <div className="card mt-8 p-10 text-center text-silver-600">
            {query ? "No hay resultados para tu búsqueda." : "Todavía no hay formaciones publicadas en esta categoría. Muy pronto."}
          </div>
        )}
      </section>
    </>
  );
}
