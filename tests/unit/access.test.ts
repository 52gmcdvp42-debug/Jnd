import { describe, expect, it } from "vitest";
import type { ContentStatus } from "@prisma/client";
import { canDownloadIn, canEarnCertificate, canViewLesson, hasFullCourseAccess, hasModuleAccess, type AccessProfile, type PlanAccess } from "@/lib/access";

const course = { id: "c1", categoryId: "cat-btc", status: "PUBLISHED" as ContentStatus };
const mod = { id: "m1", status: "PUBLISHED" as ContentStatus, course };
const mod2 = { id: "m2", status: "PUBLISHED" as ContentStatus, course };
const lesson = (over: Partial<{ status: ContentStatus; isFreePreview: boolean }> = {}, m = mod) => ({ id: "l1", status: "PUBLISHED" as ContentStatus, isFreePreview: false, ...over, module: m });

const base: AccessProfile = { userId: "u1", isStaff: false, courseIds: new Set(), moduleIds: new Set(), plans: [] };
const plan = (over: Partial<PlanAccess> = {}): PlanAccess => ({ id: "p", name: "Esencial", includesAllCourses: false, courseIds: new Set(), categoryIds: new Set(), allowDownloads: true, allowCertificates: true, ...over });

describe("control de acceso", () => {
  it("sin compras no hay acceso", () => {
    expect(canViewLesson(base, lesson())).toBe(false);
    expect(hasFullCourseAccess(base, course)).toBe(false);
  });
  it("anónimo solo ve vistas previas gratuitas de cursos publicados", () => {
    const anon = { ...base, userId: null };
    expect(canViewLesson(anon, lesson({ isFreePreview: true }))).toBe(true);
    expect(canViewLesson(anon, lesson())).toBe(false);
    expect(canViewLesson(anon, lesson({ isFreePreview: true }, { ...mod, course: { ...course, status: "DRAFT" } }))).toBe(false);
  });
  it("comprar un curso da acceso a todos sus módulos", () => {
    const p = { ...base, courseIds: new Set(["c1"]) };
    expect(canViewLesson(p, lesson())).toBe(true);
    expect(canViewLesson(p, lesson({}, mod2))).toBe(true);
  });
  it("comprar un módulo da acceso SOLO a ese módulo", () => {
    const p = { ...base, moduleIds: new Set(["m1"]) };
    expect(hasModuleAccess(p, mod)).toBe(true);
    expect(canViewLesson(p, lesson())).toBe(true);
    expect(canViewLesson(p, lesson({}, mod2))).toBe(false);
    expect(hasFullCourseAccess(p, course)).toBe(false);
  });
  it("membresía por categoría, por curso y total", () => {
    expect(canViewLesson({ ...base, plans: [plan({ categoryIds: new Set(["cat-btc"]) })] }, lesson())).toBe(true);
    expect(canViewLesson({ ...base, plans: [plan({ categoryIds: new Set(["otra"]) })] }, lesson())).toBe(false);
    expect(canViewLesson({ ...base, plans: [plan({ courseIds: new Set(["c1"]) })] }, lesson())).toBe(true);
    expect(canViewLesson({ ...base, plans: [plan({ includesAllCourses: true })] }, lesson())).toBe(true);
  });
  it("borradores no son visibles para alumnos aunque hayan pagado", () => {
    const p = { ...base, courseIds: new Set(["c1"]) };
    expect(canViewLesson(p, lesson({ status: "DRAFT" }))).toBe(false);
    expect(canViewLesson(p, lesson({}, { ...mod, status: "DRAFT" }))).toBe(false);
    expect(canViewLesson(p, lesson({}, { ...mod, course: { ...course, status: "DRAFT" } }))).toBe(false);
  });
  it("curso oculto: quien lo compró mantiene el acceso", () => {
    const hidden = { ...mod, course: { ...course, status: "HIDDEN" as ContentStatus } };
    expect(canViewLesson({ ...base, courseIds: new Set(["c1"]) }, lesson({}, hidden))).toBe(true);
    expect(canViewLesson(base, lesson({ isFreePreview: true }, hidden))).toBe(false);
  });
  it("el equipo puede previsualizar borradores", () => {
    expect(canViewLesson({ ...base, isStaff: true }, lesson({ status: "DRAFT" }))).toBe(true);
  });
  it("descargas y certificados respetan los permisos del plan", () => {
    const noDl = { ...base, plans: [plan({ includesAllCourses: true, allowDownloads: false, allowCertificates: false })] };
    expect(canDownloadIn(noDl, course, "m1")).toBe(false);
    expect(canEarnCertificate(noDl, course, ["m1", "m2"])).toBe(false);
    expect(canDownloadIn({ ...base, moduleIds: new Set(["m1"]) }, course, "m1")).toBe(true);
    expect(canEarnCertificate({ ...base, moduleIds: new Set(["m1"]) }, course, ["m1", "m2"])).toBe(false);
    expect(canEarnCertificate({ ...base, moduleIds: new Set(["m1", "m2"]) }, course, ["m1", "m2"])).toBe(true);
  });
});
