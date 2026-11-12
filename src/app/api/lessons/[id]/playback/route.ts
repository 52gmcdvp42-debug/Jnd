import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccessProfile, lessonAccessInclude } from "@/lib/access-server";
import { canViewLesson } from "@/lib/access";
import { getPlayback } from "@/lib/video";
import { resumePosition } from "@/lib/progress";
import { rateLimit } from "@/lib/rate-limit";
import { json } from "@/lib/http";

/** Entrega una URL de reproducción firmada y temporal, solo a usuarios autorizados. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({ where: { id }, include: { ...lessonAccessInclude, video: true } });
  if (!lesson?.video) return json({ error: "not_found" }, 404);
  const profile = await getAccessProfile();
  if (!canViewLesson(profile, lesson)) return json({ error: "forbidden" }, 403);

  const user = await getCurrentUser();
  if (user && !(await rateLimit(`playback:${user.id}`, 300, 3600))) return json({ error: "rate_limited" }, 429);

  let start = 0;
  if (user) {
    const p = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: id } } });
    if (p) start = resumePosition(p.positionSeconds, p.durationSeconds ?? lesson.video.durationSeconds);
  }
  try {
    const playback = await getPlayback(lesson.video.provider, lesson.video.providerVideoId);
    return json({ ...playback, start, watermark: user?.email ?? null });
  } catch (e) {
    console.error("playback", e);
    return json({ error: "video_unavailable" }, 503);
  }
}
