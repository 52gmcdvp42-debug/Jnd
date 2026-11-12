import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccessProfile, lessonAccessInclude } from "@/lib/access-server";
import { canViewLesson } from "@/lib/access";
import { shouldComplete } from "@/lib/progress";
import { json, sameOrigin } from "@/lib/http";

const body = z.object({
  position: z.number().min(0).max(24 * 3600),
  duration: z.number().min(0).max(24 * 3600).nullable().optional(),
  completed: z.boolean().optional(),
});

/** Guarda la posición exacta de reproducción y el estado de finalización. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);

  const lesson = await db.lesson.findUnique({ where: { id }, include: lessonAccessInclude });
  if (!lesson) return json({ error: "not_found" }, 404);
  if (!canViewLesson(await getAccessProfile(), lesson)) return json({ error: "forbidden" }, 403);
  if (lesson.type === "QUIZ") return json({ error: "quiz_lessons_complete_on_pass" }, 400);

  const position = Math.floor(parsed.data.position);
  const duration = parsed.data.duration ? Math.floor(parsed.data.duration) : null;
  const complete = parsed.data.completed === true || shouldComplete(position, duration);

  const existing = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: id } } });
  await db.$transaction([
    db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: id } },
      create: { userId: user.id, lessonId: id, positionSeconds: position, durationSeconds: duration, completedAt: complete ? new Date() : null },
      update: {
        positionSeconds: position,
        ...(duration ? { durationSeconds: duration } : {}),
        ...(complete && !existing?.completedAt ? { completedAt: new Date() } : {}),
      },
    }),
    db.user.update({ where: { id: user.id }, data: { lastLessonId: id, lastLessonAt: new Date() } }),
  ]);
  return json({ ok: true, completed: complete || !!existing?.completedAt });
}
