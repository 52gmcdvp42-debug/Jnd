import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ACTIVE_SUBSCRIPTION_STATUSES, anonymousProfile, isStaffRole, type AccessProfile } from "@/lib/access";

export async function loadAccessProfile(userId: string, role: string): Promise<AccessProfile> {
  const now = new Date();
  const [ents, subs] = await Promise.all([
    db.entitlement.findMany({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { courseId: true, moduleId: true },
    }),
    db.subscription.findMany({
      where: { userId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
      include: { plan: { include: { includedCourses: { select: { id: true } }, includedCategories: { select: { id: true } } } } },
    }),
  ]);
  return {
    userId,
    isStaff: isStaffRole(role as never),
    courseIds: new Set(ents.flatMap((e) => (e.courseId ? [e.courseId] : []))),
    moduleIds: new Set(ents.flatMap((e) => (e.moduleId ? [e.moduleId] : []))),
    plans: subs
      // PAST_DUE: periodo de gracia mientras Stripe reintenta el cobro, hasta fin de periodo
      .filter((s) => s.status !== "PAST_DUE" || !s.currentPeriodEnd || s.currentPeriodEnd > new Date(now.getTime() - 7 * 86400_000))
      .map((s) => ({
        id: s.plan.id,
        name: s.plan.name,
        includesAllCourses: s.plan.includesAllCourses,
        courseIds: new Set(s.plan.includedCourses.map((c) => c.id)),
        categoryIds: new Set(s.plan.includedCategories.map((c) => c.id)),
        allowDownloads: s.plan.allowDownloads,
        allowCertificates: s.plan.allowCertificates,
      })),
  };
}

/** Perfil de acceso del usuario actual (cacheado por petición). */
export const getAccessProfile = cache(async (): Promise<AccessProfile> => {
  const user = await getCurrentUser();
  if (!user) return anonymousProfile;
  return loadAccessProfile(user.id, user.role);
});

export const lessonAccessInclude = {
  module: { select: { id: true, status: true, course: { select: { id: true, categoryId: true, status: true } } } },
} as const;
