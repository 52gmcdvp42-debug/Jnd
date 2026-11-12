import "server-only";
import { db } from "@/lib/db";
import type { AccessProfile } from "@/lib/access";
import { hasAnyCourseAccess } from "@/lib/access";

/** Cursos a los que el alumno tiene algún acceso, con su progreso. */
export async function studentCourses(userId: string, profile: AccessProfile) {
  const courses = await db.course.findMany({
    where: { status: { in: ["PUBLISHED", "HIDDEN"] } },
    orderBy: [{ sortOrder: "asc" }],
    include: {
      category: true,
      modules: {
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, lessons: { where: { status: "PUBLISHED" }, select: { id: true } } },
      },
    },
  });
  const mine = courses.filter((c) => hasAnyCourseAccess({ ...profile, isStaff: false }, c, c.modules.map((m) => m.id)));
  const lessonIds = mine.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
  const done = await db.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } }, select: { lessonId: true } });
  const doneSet = new Set(done.map((d) => d.lessonId));
  return mine.map((c) => {
    const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const completed = ids.filter((id) => doneSet.has(id)).length;
    const full = profile.courseIds.has(c.id) || profile.plans.some((p) => p.includesAllCourses || p.courseIds.has(c.id) || (c.categoryId && p.categoryIds.has(c.categoryId)));
    return {
      course: c,
      full,
      ownedModules: full ? c.modules : c.modules.filter((m) => profile.moduleIds.has(m.id)),
      total: ids.length,
      completed,
      percent: ids.length ? Math.floor((completed / ids.length) * 100) : 0,
    };
  });
}
