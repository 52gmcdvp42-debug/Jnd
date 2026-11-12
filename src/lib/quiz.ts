/** Corrección de cuestionarios. Se ejecuta SOLO en el servidor. */

export type GradableQuestion = { id: string; options: { id: string; isCorrect: boolean }[] };
export type Answers = Record<string, string[]>;

export type GradeResult = {
  score: number; // 0-100
  correctCount: number;
  total: number;
  perQuestion: Record<string, { correct: boolean; correctOptionIds: string[] }>;
};

export function gradeQuiz(questions: GradableQuestion[], answers: Answers): GradeResult {
  let correctCount = 0;
  const perQuestion: GradeResult["perQuestion"] = {};
  for (const q of questions) {
    const valid = new Set(q.options.map((o) => o.id));
    const correct = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const given = new Set((answers[q.id] ?? []).filter((id) => valid.has(id)));
    const ok = correct.size > 0 && given.size === correct.size && [...given].every((id) => correct.has(id));
    if (ok) correctCount++;
    perQuestion[q.id] = { correct: ok, correctOptionIds: [...correct] };
  }
  const total = questions.length;
  return { score: total ? Math.round((correctCount / total) * 100) : 0, correctCount, total, perQuestion };
}

/** Convierte FormData (q_<questionId> = optionId, repetible) en Answers. */
export function answersFromFormData(fd: FormData): Answers {
  const out: Answers = {};
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("q_") || typeof value !== "string") continue;
    const qid = key.slice(2);
    (out[qid] ??= []).push(value);
  }
  return out;
}
