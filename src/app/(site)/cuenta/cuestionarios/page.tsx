import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/StatusBadge";

export const metadata = { title: "Resultados" };

export default async function QuizResultsPage() {
  const user = await requireUser("/cuenta/cuestionarios");
  const attempts = await db.quizAttempt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { quiz: { include: { lesson: { include: { module: { include: { course: { select: { title: true, slug: true } } } } } } } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cuestionarios y resultados</h1>
      {attempts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-silver-600">Todavía no has realizado ningún cuestionario.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Cuestionario</th><th>Curso</th><th>Nota</th><th>Resultado</th><th>Fecha</th></tr></thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td><Link className="hover:text-electric" href={`/aprender/${a.quiz.lesson.module.course.slug}/${a.quiz.lessonId}`}>{a.quiz.lesson.title}</Link>{a.quiz.isExam && <span className="ml-2"><Badge tone="blue">Evaluación</Badge></span>}</td>
                  <td>{a.quiz.lesson.module.course.title}</td>
                  <td className="font-semibold">{a.score}%</td>
                  <td>{a.passed ? <Badge tone="green">Aprobado</Badge> : <Badge tone="amber">No aprobado</Badge>}</td>
                  <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
