import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccessProfile } from "@/lib/access-server";
import { canViewLesson, courseVisible } from "@/lib/access";
import { publishedCourseTree } from "@/lib/learning";

/** Entra al curso y reanuda en la última lección vista (o la primera disponible). */
export default async function CourseEntry({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/aprender/${slug}`);
  const profile = await getAccessProfile();
  const course = await db.course.findUnique({ where: { slug } });
  if (!course || !courseVisible(profile, course)) notFound();
  const modules = await publishedCourseTree(course.id);
  const lessons = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, module: { ...m, course } })));
  const accessible = lessons.filter((l) => canViewLesson(profile, { ...l, status: "PUBLISHED" }));
  if (!accessible.length) redirect(`/cursos/${slug}`);

  const progress = await db.lessonProgress.findMany({
    where: { userId: user.id, lessonId: { in: accessible.map((l) => l.id) } },
    orderBy: { updatedAt: "desc" },
  });
  const last = progress[0];
  const firstPending = accessible.find((l) => !progress.some((p) => p.lessonId === l.id && p.completedAt));
  const target = last && !last.completedAt ? last.lessonId : (firstPending?.id ?? last?.lessonId ?? accessible[0].id);
  redirect(`/aprender/${slug}/${target}`);
}
