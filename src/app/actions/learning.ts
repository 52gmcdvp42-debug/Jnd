"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccessProfile, lessonAccessInclude } from "@/lib/access-server";
import { canViewLesson } from "@/lib/access";
import { answersFromFormData, gradeQuiz, type GradeResult } from "@/lib/quiz";
import { issueCertificateIfEligible } from "@/lib/learning";
import { rateLimit } from "@/lib/rate-limit";

export type QuizState = { error?: string; result?: GradeResult & { passed: boolean; showAnswers: boolean; answers: Record<string, string[]>; explanations: Record<string, string | null> } } | null;

/** Corrige el cuestionario en el servidor. Las respuestas correctas nunca llegan al navegador antes de enviar. */
export async function submitQuizAction(_: QuizState, fd: FormData): Promise<QuizState> {
  const user = await requireUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { ...lessonAccessInclude, quiz: { include: { questions: { include: { options: true } } } } },
  });
  if (!lesson?.quiz) return { error: "Cuestionario no encontrado." };
  const profile = await getAccessProfile();
  if (!canViewLesson(profile, lesson)) return { error: "No tienes acceso a este cuestionario." };
  if (!(await rateLimit(`quiz:${user.id}`, 60, 3600))) return { error: "Demasiados intentos. Inténtalo más tarde." };

  const quiz = lesson.quiz;
  if (quiz.maxAttempts) {
    const count = await db.quizAttempt.count({ where: { quizId: quiz.id, userId: user.id } });
    if (count >= quiz.maxAttempts) return { error: "Has agotado el número de intentos permitidos." };
  }
  if (quiz.questions.length === 0) return { error: "Este cuestionario aún no tiene preguntas." };

  const answers = answersFromFormData(fd);
  const result = gradeQuiz(quiz.questions, answers);
  const passed = result.score >= quiz.passingScore;
  await db.quizAttempt.create({ data: { quizId: quiz.id, userId: user.id, score: result.score, passed, answers } });
  if (passed) {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, completedAt: new Date() },
      update: { completedAt: new Date() },
    });
  }
  await db.user.update({ where: { id: user.id }, data: { lastLessonId: lessonId, lastLessonAt: new Date() } });
  await issueCertificateIfEligible(profile, user.id, lesson.module.course.id).catch(() => null);
  revalidatePath("/aprender", "layout");
  return {
    result: {
      ...(quiz.showAnswers ? result : { ...result, perQuestion: Object.fromEntries(Object.entries(result.perQuestion).map(([k, v]) => [k, { correct: v.correct, correctOptionIds: [] }])) }),
      passed,
      answers,
      showAnswers: quiz.showAnswers,
      explanations: quiz.showAnswers ? Object.fromEntries(quiz.questions.map((q) => [q.id, q.explanation])) : {},
    },
  };
}

/** Marcar manualmente como completada una lección de texto o vídeo. */
export async function toggleCompleteAction(fd: FormData) {
  const user = await requireUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: lessonAccessInclude });
  const profile = await getAccessProfile();
  if (!lesson || lesson.type === "QUIZ" || !canViewLesson(profile, lesson)) return;
  const existing = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  const completedAt = existing?.completedAt ? null : new Date();
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId, completedAt },
    update: { completedAt },
  });
  await db.user.update({ where: { id: user.id }, data: { lastLessonId: lessonId, lastLessonAt: new Date() } });
  if (completedAt) await issueCertificateIfEligible(profile, user.id, lesson.module.course.id).catch(() => null);
  revalidatePath("/aprender", "layout");
}

export async function claimCertificateAction(fd: FormData) {
  const user = await requireUser();
  const courseId = String(fd.get("courseId") ?? "");
  await issueCertificateIfEligible(await getAccessProfile(), user.id, courseId);
  revalidatePath("/cuenta/certificados");
  revalidatePath("/aprender", "layout");
}
