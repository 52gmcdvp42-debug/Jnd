import "server-only";
import { db } from "@/lib/db";
import { evaluateCertificate } from "@/lib/certificate-rules";
import { canEarnCertificate, type AccessProfile } from "@/lib/access";
import { certificateCode } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth/session";

/** Estructura publicada del curso (para alumnos). */
export async function publishedCourseTree(courseId: string) {
  return db.module.findMany({
    where: { courseId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      lessons: {
        where: { status: "PUBLISHED" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, type: true, isFreePreview: true, video: { select: { durationSeconds: true } }, quiz: { select: { id: true, isExam: true, passingScore: true } } },
      },
    },
  });
}

export async function courseProgress(userId: string, courseId: string) {
  const modules = await publishedCourseTree(courseId);
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const done = await db.lessonProgress.count({ where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } } });
  const exams = modules.flatMap((m) => m.lessons.filter((l) => l.quiz?.isExam).map((l) => l.quiz!));
  const best = exams.length
    ? await db.quizAttempt.groupBy({ by: ["quizId"], where: { userId, quizId: { in: exams.map((e) => e.id) } }, _max: { score: true } })
    : [];
  const bestMap = new Map(best.map((b) => [b.quizId, b._max.score]));
  return {
    modules,
    totalLessons: lessonIds.length,
    completedLessons: done,
    percent: lessonIds.length ? Math.floor((done / lessonIds.length) * 100) : 0,
    exams: exams.map((e) => ({ quizId: e.id, passingScore: e.passingScore, bestScore: bestMap.get(e.id) ?? null })),
  };
}

export async function certificateStatus(profile: AccessProfile, userId: string, courseId: string) {
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  const p = await courseProgress(userId, courseId);
  const evaluation = evaluateCertificate(course, p);
  const allowed = canEarnCertificate(profile, course, p.modules.map((m) => m.id));
  if (!allowed) evaluation.reasons.push("Tu acceso actual no incluye certificado para este curso.");
  const existing = await db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  return { course, progress: p, evaluation: { ...evaluation, eligible: evaluation.eligible && allowed }, existing };
}

/** Emite el certificado si se cumplen los requisitos (comprobado en servidor). */
export async function issueCertificateIfEligible(profile: AccessProfile, userId: string, courseId: string) {
  const status = await certificateStatus(profile, userId, courseId);
  if (status.existing && !status.existing.revokedAt) return status.existing;
  if (!status.evaluation.eligible) return null;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (status.existing) {
    return db.certificate.update({
      where: { id: status.existing.id },
      data: { revokedAt: null, revokeReason: null, issuedAt: new Date(), code: certificateCode(), studentName: user.name, score: status.evaluation.averageScore },
    });
  }
  return db.certificate.create({
    data: {
      code: certificateCode(),
      userId,
      courseId,
      studentName: user.name,
      courseTitle: status.course.title,
      score: status.evaluation.averageScore,
    },
  });
}

export async function touchLastLesson(lessonId: string) {
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { lastLessonId: lessonId, lastLessonAt: new Date() } });
}
