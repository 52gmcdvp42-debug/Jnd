/** Requisitos de certificado (lógica pura). */

export type CertRules = {
  certificateEnabled: boolean;
  certMinProgress: number;
  certMinScore: number;
  certRequireAllQuizzes: boolean;
};

export type CertInput = {
  totalLessons: number;
  completedLessons: number;
  exams: { quizId: string; passingScore: number; bestScore: number | null }[];
};

export type CertEvaluation = {
  eligible: boolean;
  progressPercent: number;
  averageScore: number | null;
  reasons: string[];
};

export function evaluateCertificate(rules: CertRules, input: CertInput): CertEvaluation {
  const reasons: string[] = [];
  const progressPercent = input.totalLessons ? Math.floor((input.completedLessons / input.totalLessons) * 100) : 0;
  const averageScore = input.exams.length ? Math.round(input.exams.reduce((s, e) => s + (e.bestScore ?? 0), 0) / input.exams.length) : null;

  if (!rules.certificateEnabled) reasons.push("Este curso no emite certificado.");
  if (input.totalLessons === 0) reasons.push("El curso todavía no tiene lecciones publicadas.");
  if (progressPercent < rules.certMinProgress) reasons.push(`Progreso mínimo requerido: ${rules.certMinProgress}% (actual: ${progressPercent}%).`);
  if (rules.certRequireAllQuizzes) {
    const pending = input.exams.filter((e) => e.bestScore == null || e.bestScore < e.passingScore).length;
    if (pending) reasons.push(`Evaluaciones pendientes de aprobar: ${pending}.`);
  }
  if (input.exams.length && (averageScore ?? 0) < rules.certMinScore)
    reasons.push(`Nota media mínima: ${rules.certMinScore} (actual: ${averageScore ?? 0}).`);
  return { eligible: reasons.length === 0, progressPercent, averageScore, reasons };
}
