import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { gradeQuiz, answersFromFormData } from "@/lib/quiz";
import { evaluateCertificate } from "@/lib/certificate-rules";
import { resumePosition, shouldComplete } from "@/lib/progress";
import { parsePriceToCents, slugify } from "@/lib/format";
import { certificateCode } from "@/lib/crypto";
import { signBunnyUrl } from "@/lib/video";

describe("cuestionarios", () => {
  const qs = [
    { id: "q1", options: [{ id: "a", isCorrect: true }, { id: "b", isCorrect: false }] },
    { id: "q2", options: [{ id: "c", isCorrect: true }, { id: "d", isCorrect: true }, { id: "e", isCorrect: false }] },
  ];
  it("corrige respuesta única y múltiple (exacta)", () => {
    expect(gradeQuiz(qs, { q1: ["a"], q2: ["c", "d"] }).score).toBe(100);
    expect(gradeQuiz(qs, { q1: ["a"], q2: ["c"] }).score).toBe(50);
    expect(gradeQuiz(qs, { q1: ["a", "b"], q2: ["c", "d", "e"] }).score).toBe(0);
  });
  it("ignora ids de opciones inventados", () => {
    expect(gradeQuiz(qs, { q1: ["zzz"], q2: [] }).score).toBe(0);
  });
  it("lee las respuestas del formulario", () => {
    const fd = new FormData();
    fd.append("q_q2", "c");
    fd.append("q_q2", "d");
    fd.append("lessonId", "x");
    expect(answersFromFormData(fd)).toEqual({ q2: ["c", "d"] });
  });
});

describe("certificados", () => {
  const rules = { certificateEnabled: true, certMinProgress: 100, certMinScore: 70, certRequireAllQuizzes: true };
  it("exige progreso y evaluaciones aprobadas", () => {
    expect(evaluateCertificate(rules, { totalLessons: 10, completedLessons: 10, exams: [{ quizId: "x", passingScore: 70, bestScore: 80 }] }).eligible).toBe(true);
    expect(evaluateCertificate(rules, { totalLessons: 10, completedLessons: 9, exams: [] }).eligible).toBe(false);
    expect(evaluateCertificate(rules, { totalLessons: 10, completedLessons: 10, exams: [{ quizId: "x", passingScore: 70, bestScore: null }] }).eligible).toBe(false);
    expect(evaluateCertificate({ ...rules, certMinScore: 90, certRequireAllQuizzes: false }, { totalLessons: 1, completedLessons: 1, exams: [{ quizId: "x", passingScore: 50, bestScore: 80 }] }).eligible).toBe(false);
    expect(evaluateCertificate({ ...rules, certificateEnabled: false }, { totalLessons: 1, completedLessons: 1, exams: [] }).eligible).toBe(false);
  });
  it("genera códigos únicos con formato verificable", () => {
    const codes = new Set(Array.from({ length: 1000 }, certificateCode));
    expect(codes.size).toBe(1000);
    for (const c of codes) expect(c).toMatch(/^JND-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

describe("progreso de vídeo", () => {
  it("completa al 90 % y reanuda en la posición exacta", () => {
    expect(shouldComplete(5400 * 0.9, 5400)).toBe(true);
    expect(shouldComplete(4000, 5400)).toBe(false);
    expect(resumePosition(3725, 5400)).toBe(3725);
    expect(resumePosition(5395, 5400)).toBe(0);
  });
});

describe("utilidades", () => {
  it("precios en formato español", () => {
    expect(parsePriceToCents("49,90")).toBe(4990);
    expect(parsePriceToCents("1.290,00")).toBe(129000);
    expect(parsePriceToCents("29")).toBe(2900);
    expect(parsePriceToCents("")).toBeNull();
    expect(() => parsePriceToCents("abc")).toThrow();
  });
  it("slugs", () => expect(slugify("Análisis Técnico & Fundamental")).toBe("analisis-tecnico-fundamental"));
});

describe("firma de Bunny CDN", () => {
  it("firma el directorio del vídeo según el algoritmo de token de Bunny", () => {
    const url = signBunnyUrl({ host: "vz-abc.b-cdn.net", tokenKey: "key", videoId: "vid-1", expires: 1700000000 });
    const expected = createHash("sha256").update("key/vid-1/1700000000token_path=/vid-1/").digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    expect(url).toBe(`https://vz-abc.b-cdn.net/bcdn_token=${expected}&token_path=%2Fvid-1%2F&expires=1700000000/vid-1/playlist.m3u8`);
  });
});
