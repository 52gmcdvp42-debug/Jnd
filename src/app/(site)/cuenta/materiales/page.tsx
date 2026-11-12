import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccessProfile } from "@/lib/access-server";
import { canDownloadIn } from "@/lib/access";
import { studentCourses } from "@/lib/student";

export const metadata = { title: "Materiales" };

export default async function MaterialsPage() {
  const user = await requireUser("/cuenta/materiales");
  const profile = await getAccessProfile();
  const courses = await studentCourses(user.id, profile);
  const groups = await Promise.all(
    courses.map(async ({ course, ownedModules }) => {
      const moduleIds = ownedModules.map((m) => m.id);
      const resources = await db.resource.findMany({
        where: {
          OR: [
            { courseId: course.id },
            { moduleId: { in: moduleIds } },
            { lesson: { status: "PUBLISHED", moduleId: { in: moduleIds } } },
          ],
        },
        include: { module: { select: { id: true, title: true } }, lesson: { select: { title: true, moduleId: true } } },
        orderBy: { sortOrder: "asc" },
      });
      const visible = resources.filter((r) => r.isPublic || canDownloadIn({ ...profile, isStaff: false }, course, r.moduleId ?? r.lesson?.moduleId ?? null));
      return { course, resources: visible };
    }),
  );
  const nonEmpty = groups.filter((g) => g.resources.length);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Materiales</h1>
      {nonEmpty.length === 0 ? (
        <div className="card p-8 text-center text-sm text-silver-600">No hay materiales disponibles por ahora.</div>
      ) : (
        nonEmpty.map((g) => (
          <section key={g.course.id} className="card p-5">
            <h2 className="font-semibold">{g.course.title}</h2>
            <ul className="mt-3 divide-y divide-silver-300/40">
              {g.resources.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{r.title}<span className="block text-xs text-silver-600">{r.lesson?.title ?? r.module?.title ?? "Curso"}</span></span>
                  <a href={`/api/resources/${r.id}/download`} className="btn-outline btn-sm">{r.externalUrl ? "Abrir" : "Descargar"}</a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
