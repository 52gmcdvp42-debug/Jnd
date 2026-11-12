import type { ContentStatus, Role } from "@prisma/client";

/**
 * Control de acceso a contenidos. TODA comprobación de acceso pasa por aquí y se
 * ejecuta en el servidor (páginas, API de vídeo, descargas, cuestionarios, certificados).
 *
 * Reglas de visibilidad:
 *  - Curso DRAFT: solo equipo (ADMIN/EDITOR).
 *  - Curso HIDDEN: no aparece en el catálogo; quien ya tiene acceso puede seguir usándolo.
 *  - Curso PUBLISHED: visible en catálogo.
 *  - Módulos y lecciones: solo PUBLISHED son visibles para alumnos.
 */

export type PlanAccess = {
  id: string;
  name: string;
  includesAllCourses: boolean;
  courseIds: Set<string>;
  categoryIds: Set<string>;
  allowDownloads: boolean;
  allowCertificates: boolean;
};

export type AccessProfile = {
  userId: string | null;
  isStaff: boolean;
  courseIds: Set<string>; // cursos comprados / concedidos
  moduleIds: Set<string>; // módulos comprados / concedidos
  plans: PlanAccess[]; // membresías activas
};

export type CourseRef = { id: string; categoryId: string | null; status: ContentStatus };
export type ModuleRef = { id: string; status: ContentStatus; course: CourseRef };
export type LessonRef = { id: string; status: ContentStatus; isFreePreview: boolean; module: ModuleRef };

export const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

export const anonymousProfile: AccessProfile = {
  userId: null,
  isStaff: false,
  courseIds: new Set(),
  moduleIds: new Set(),
  plans: [],
};

export function isStaffRole(role: Role | null | undefined) {
  return role === "ADMIN" || role === "EDITOR";
}

export function courseVisible(profile: AccessProfile, course: Pick<CourseRef, "status">) {
  return profile.isStaff || course.status !== "DRAFT";
}

export function planCoversCourse(plan: PlanAccess, course: Pick<CourseRef, "id" | "categoryId">) {
  return (
    plan.includesAllCourses ||
    plan.courseIds.has(course.id) ||
    (course.categoryId != null && plan.categoryIds.has(course.categoryId))
  );
}

export function coveringPlans(profile: AccessProfile, course: Pick<CourseRef, "id" | "categoryId">) {
  return profile.plans.filter((p) => planCoversCourse(p, course));
}

/** Acceso al curso completo (compra del curso o membresía que lo incluye). */
export function hasFullCourseAccess(profile: AccessProfile, course: CourseRef) {
  if (profile.isStaff) return true;
  if (!courseVisible(profile, course)) return false;
  return profile.courseIds.has(course.id) || coveringPlans(profile, course).length > 0;
}

export function hasModuleAccess(profile: AccessProfile, mod: ModuleRef) {
  if (profile.isStaff) return true;
  if (mod.status !== "PUBLISHED" || !courseVisible(profile, mod.course)) return false;
  return hasFullCourseAccess(profile, mod.course) || profile.moduleIds.has(mod.id);
}

/** ¿Tiene el usuario algún tipo de acceso dentro del curso? */
export function hasAnyCourseAccess(profile: AccessProfile, course: CourseRef, moduleIds: string[]) {
  return hasFullCourseAccess(profile, course) || moduleIds.some((id) => profile.moduleIds.has(id));
}

export function canViewLesson(profile: AccessProfile, lesson: LessonRef) {
  if (profile.isStaff) return true;
  if (lesson.status !== "PUBLISHED" || lesson.module.status !== "PUBLISHED") return false;
  if (lesson.module.course.status !== "PUBLISHED" && !hasAnyCourseAccess(profile, lesson.module.course, [lesson.module.id]))
    return false;
  if (lesson.isFreePreview && lesson.module.course.status === "PUBLISHED") return true;
  if (!profile.userId) return false;
  return hasModuleAccess(profile, lesson.module);
}

/** Descargas: por compra siempre; por membresía solo si el plan lo permite. */
export function canDownloadIn(profile: AccessProfile, course: CourseRef, moduleId: string | null) {
  if (profile.isStaff) return true;
  if (!profile.userId || !courseVisible(profile, course)) return false;
  if (profile.courseIds.has(course.id)) return true;
  if (moduleId && profile.moduleIds.has(moduleId)) return true;
  return coveringPlans(profile, course).some((p) => p.allowDownloads);
}

/** Certificado: acceso completo al curso; si viene solo de membresía, el plan debe permitirlo. */
export function canEarnCertificate(profile: AccessProfile, course: CourseRef, allModuleIds: string[]) {
  if (profile.isStaff) return true;
  if (profile.courseIds.has(course.id)) return true;
  if (allModuleIds.length > 0 && allModuleIds.every((id) => profile.moduleIds.has(id))) return true;
  return coveringPlans(profile, course).some((p) => p.allowCertificates);
}
