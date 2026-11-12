"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitQuizAction, type QuizState } from "@/app/actions/learning";

type Q = { id: string; text: string; multiple: boolean; options: { id: string; text: string }[] };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Corrigiendo…" : "Enviar respuestas"}</button>;
}

export function QuizForm({ lessonId, questions, passingScore, attemptsLeft }: { lessonId: string; questions: Q[]; passingScore: number; attemptsLeft: number | null }) {
  const [state, action] = useActionState<QuizState, FormData>(submitQuizAction, null);
  const r = state?.result;
  return (
    <form action={action} className="space-y-6" key={r ? "graded" : "open"}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <p className="text-sm text-silver-600">
        Nota mínima para aprobar: <strong>{passingScore}%</strong>
        {attemptsLeft != null && <> · Intentos restantes: <strong>{attemptsLeft}</strong></>}
      </p>
      {questions.map((q, i) => {
        const pq = r?.perQuestion[q.id];
        return (
          <fieldset key={q.id} className={`card p-5 ${pq ? (pq.correct ? "border-emerald-300" : "border-red-300") : ""}`}>
            <legend className="sr-only">Pregunta {i + 1}</legend>
            <p className="font-medium">
              <span className="text-electric">{i + 1}.</span> {q.text}
            </p>
            {q.multiple && <p className="mt-1 text-xs text-silver-600">Puede haber varias respuestas correctas.</p>}
            <div className="mt-3 space-y-2">
              {q.options.map((o) => {
                const isRight = pq?.correctOptionIds.includes(o.id);
                return (
                  <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${isRight ? "border-emerald-400 bg-emerald-50" : "border-silver-300/70 hover:border-electric"}`}>
                    <input type={q.multiple ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} className="mt-0.5 accent-electric" disabled={!!r} defaultChecked={!!r?.answers[q.id]?.includes(o.id)} />
                    <span>{o.text}</span>
                  </label>
                );
              })}
            </div>
            {pq && <p className={`mt-3 text-sm font-medium ${pq.correct ? "text-emerald-700" : "text-red-700"}`}>{pq.correct ? "Correcta" : "Incorrecta"}</p>}
            {r?.explanations[q.id] && <p className="mt-1 text-sm text-silver-600">{r.explanations[q.id]}</p>}
          </fieldset>
        );
      })}
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {r ? (
        <div className={`rounded-xl p-5 ${r.passed ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          <p className="font-display text-2xl font-bold">{r.score}%</p>
          <p className="text-sm">{r.correctCount} de {r.total} correctas · {r.passed ? "¡Aprobado!" : "No aprobado. Repasa el contenido y vuelve a intentarlo."}</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-outline btn-sm mt-3">Volver a intentarlo</button>
        </div>
      ) : (
        <SubmitBtn />
      )}
    </form>
  );
}
