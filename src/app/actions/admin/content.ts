"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ContentStatus, LessonType, Level, VideoProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { parsePriceToCents, slugify } from "@/lib/format";
import { deleteFile, makeKey, MAX_UPLOAD_BYTES, putFile } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { run, str, optStr, bool, int, clamp, UserError } from "./_util";
import type { FormState } from "@/components/ui/Form";

const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
const status = (fd: FormData) => z.enum(STATUSES).parse(str(fd, "status") || "DRAFT") as ContentStatus;
const title = (fd: FormData, k = "title") => z.string().min(2, "El título es obligatorio").max(200).parse(str(fd, k));

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

// ─────────── Categorías ───────────

export async function saveCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  return run(async () => {
    const id = optStr(fd, "id");
    const name = title(fd, "name");
    const data = {
      name,
      slug: slugify(str(fd, "slug") || name),
      description: optStr(fd, "description"),
      status: status(fd),
      sortOrder: int(fd, "sortOrder"),
    };
    if (!data.slug) throw new UserError("Slug no válido.");
    const c = id ? await db.category.update({ where: { id }, data }) : await db.category.create({ data });
    await audit(user.id, id ? "category.update" : "category.create", c.id);
    refresh();
    return id ? "Categoría actualizada." : "Categoría creada.";
  });
}

export async function deleteCategoryAction(fd: FormData) {
  const user = await requireStaff();
  const id = str(fd, "id");
  const count = await db.course.count({ where: { categoryId: id } });
  if (count) return; // la interfaz solo ofrece borrar categorías vacías
  await db.category.delete({ where: { id } });
  await audit(user.id, "category.delete", id);
  refresh();
}

// ─────────── Cursos ───────────

export async function createCourseAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  let id = "";
  const res = await run(async () => {
    const t = title(fd);
    let slug = slugify(t);
    if (await db.course.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const c = await db.course.create({ data: { title: t, slug, categoryId: optStr(fd, "categoryId"), status: "DRAFT" } });
    id = c.id;
    await audit(user.id, "course.create", c.id);
  });
  if (id) redirect(`/admin/cursos/${id}`);
  return res;
}

export async function updateCourseAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  return run(async () => {
    const id = str(fd, "id");
    const t = title(fd);
    const slug = slugify(str(fd, "slug") || t);
    if (!slug) throw new UserError("Slug no válido.");
    await db.course.update({
      where: { id },
      data: {
        title: t,
        slug,
        subtitle: optStr(fd, "subtitle"),
        description: optStr(fd, "description"),
        categoryId: optStr(fd, "categoryId"),
        level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).parse(str(fd, "level")) as Level,
        status: status(fd),
        sortOrder: int(fd, "sortOrder"),
        priceCents: parsePriceToCents(fd.get("price")),
        certificateEnabled: bool(fd, "certificateEnabled"),
        certMinProgress: clamp(int(fd, "certMinProgress", 100), 0, 100),
        certMinScore: clamp(int(fd, "certMinScore", 70), 0, 100),
        certRequireAllQuizzes: bool(fd, "certRequireAllQuizzes"),
      },
    });
    await audit(user.id, "course.update", id);
    refresh();
  });
}

export async function uploadCoverAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return run(async () => {
    const id = str(fd, "id");
    const file = fd.get("cover");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecciona una imagen.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new UserError("Formato admitido: JPG, PNG o WebP.");
    if (file.size > 5 * 1024 * 1024) throw new UserError("La imagen no puede superar 5 MB.");
    const course = await db.course.findUniqueOrThrow({ where: { id } });
    const key = makeKey("public", "covers", file.name);
    await putFile(key, Buffer.from(await file.arrayBuffer()), file.type);
    await db.course.update({ where: { id }, data: { coverImageKey: key } });
    if (course.coverImageKey) await deleteFile(course.coverImageKey);
    refresh();
    return "Portada actualizada.";
  });
}

async function purchaseCount(where: { courseId?: string; moduleId?: string }) {
  const [ents, items] = await Promise.all([db.entitlement.count({ where }), db.orderItem.count({ where })]);
  return ents + items;
}

export async function deleteCourseAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = str(fd, "id");
  const res = await run(async () => {
    if (str(fd, "confirm") !== "ELIMINAR") throw new UserError("Escribe ELIMINAR para confirmar.");
    if (await purchaseCount({ courseId: id })) throw new UserError("Este curso tiene compras o accesos asociados. Para protegerlos no se puede eliminar: cámbialo a «Oculto».");
    if (await db.certificate.count({ where: { courseId: id } })) throw new UserError("Este curso tiene certificados emitidos. Cámbialo a «Oculto» en lugar de eliminarlo.");
    const c = await db.course.delete({ where: { id } });
    if (c.coverImageKey) await deleteFile(c.coverImageKey);
    await audit(user.id, "course.delete", id, { title: c.title });
  });
  if (res?.ok) {
    refresh();
    redirect("/admin/cursos");
  }
  return res;
}

export async function setStatusAction(fd: FormData) {
  const user = await requireStaff();
  const kind = z.enum(["course", "module", "lesson"]).parse(str(fd, "kind"));
  const id = str(fd, "id");
  const s = status(fd);
  if (kind === "course") await db.course.update({ where: { id }, data: { status: s } });
  if (kind === "module") await db.module.update({ where: { id }, data: { status: s } });
  if (kind === "lesson") await db.lesson.update({ where: { id }, data: { status: s } });
  await audit(user.id, `${kind}.status`, id, { status: s });
  refresh();
}

// ─────────── Módulos ───────────

export async function createModuleAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return run(async () => {
    const courseId = str(fd, "courseId");
    const last = await db.module.aggregate({ where: { courseId }, _max: { sortOrder: true } });
    await db.module.create({ data: { courseId, title: title(fd), status: "DRAFT", sortOrder: (last._max.sortOrder ?? 0) + 10 } });
    refresh();
    return "Módulo creado como borrador.";
  });
}

export async function updateModuleAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  return run(async () => {
    const id = str(fd, "id");
    await db.module.update({
      where: { id },
      data: { title: title(fd), description: optStr(fd, "description"), status: status(fd), sortOrder: int(fd, "sortOrder"), priceCents: parsePriceToCents(fd.get("price")) },
    });
    await audit(user.id, "module.update", id);
    refresh();
  });
}

export async function deleteModuleAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = str(fd, "id");
  let courseId = "";
  const res = await run(async () => {
    if (await purchaseCount({ moduleId: id })) throw new UserError("Este módulo tiene compras asociadas. Cámbialo a «Oculto» en lugar de eliminarlo.");
    const m = await db.module.delete({ where: { id } });
    courseId = m.courseId;
    await audit(user.id, "module.delete", id, { title: m.title });
  });
  if (courseId) {
    refresh();
    redirect(`/admin/cursos/${courseId}`);
  }
  return res;
}

// ─────────── Lecciones ───────────

export async function createLessonAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return run(async () => {
    const moduleId = str(fd, "moduleId");
    const type = z.enum(["VIDEO", "TEXT", "QUIZ"]).parse(str(fd, "type")) as LessonType;
    const last = await db.lesson.aggregate({ where: { moduleId }, _max: { sortOrder: true } });
    await db.lesson.create({
      data: {
        moduleId,
        title: title(fd),
        type,
        status: "DRAFT",
        sortOrder: (last._max.sortOrder ?? 0) + 10,
        ...(type === "QUIZ" ? { quiz: { create: {} } } : {}),
      },
    });
    refresh();
    return "Lección creada como borrador.";
  });
}

export async function updateLessonAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  return run(async () => {
    const id = str(fd, "id");
    const type = z.enum(["VIDEO", "TEXT", "QUIZ"]).parse(str(fd, "type")) as LessonType;
    const lesson = await db.lesson.update({
      where: { id },
      data: {
        title: title(fd),
        type,
        content: optStr(fd, "content"),
        status: status(fd),
        sortOrder: int(fd, "sortOrder"),
        isFreePreview: bool(fd, "isFreePreview"),
        videoId: optStr(fd, "videoId"),
      },
      include: { quiz: true },
    });
    if (type === "QUIZ" && !lesson.quiz) await db.quiz.create({ data: { lessonId: id } });
    await audit(user.id, "lesson.update", id);
    refresh();
  });
}

export async function deleteLessonAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  const id = str(fd, "id");
  let moduleId = "";
  const res = await run(async () => {
    const resources = await db.resource.findMany({ where: { lessonId: id } });
    const l = await db.lesson.delete({ where: { id } });
    for (const r of resources) if (r.storageKey) await deleteFile(r.storageKey);
    moduleId = l.moduleId;
    await audit(user.id, "lesson.delete", id, { title: l.title });
  });
  if (moduleId) {
    refresh();
    redirect(`/admin/modulos/${moduleId}`);
  }
  return res;
}

// ─────────── Vídeos ───────────

export async function saveVideoAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  return run(async () => {
    const id = optStr(fd, "id");
    const provider = z.enum(["BUNNY", "MUX", "URL"]).parse(str(fd, "provider")) as VideoProvider;
    let providerVideoId = z.string().min(3, "Indica el identificador o la URL del vídeo").max(500).parse(str(fd, "providerVideoId"));
    if (provider === "URL" && !/^https:\/\//.test(providerVideoId)) throw new UserError("La URL debe empezar por https://");
    if (provider !== "URL" && !/^[\w-]+$/.test(providerVideoId)) throw new UserError("El identificador solo puede contener letras, números y guiones.");
    providerVideoId = providerVideoId.trim();
    const mins = str(fd, "durationMinutes").replace(",", ".");
    const durationSeconds = mins ? Math.round(Number(mins) * 60) || null : null;
    const data = { title: title(fd), provider, providerVideoId, durationSeconds };
    const v = id ? await db.video.update({ where: { id }, data }) : await db.video.create({ data });
    const lessonId = optStr(fd, "attachToLesson");
    if (lessonId) await db.lesson.update({ where: { id: lessonId }, data: { videoId: v.id } });
    await audit(user.id, id ? "video.update" : "video.create", v.id);
    refresh();
    return id ? "Vídeo actualizado." : "Vídeo añadido a la biblioteca.";
  });
}

export async function deleteVideoAction(fd: FormData) {
  const user = await requireStaff();
  const id = str(fd, "id");
  await db.video.delete({ where: { id } }); // las lecciones quedan sin vídeo (SetNull)
  await audit(user.id, "video.delete", id);
  refresh();
}

// ─────────── Materiales ───────────

export async function addResourceAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireStaff();
  return run(async () => {
    const target = z.enum(["course", "module", "lesson"]).parse(str(fd, "target"));
    const targetId = str(fd, "targetId");
    const file = fd.get("file");
    const externalUrl = optStr(fd, "externalUrl");
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile && !externalUrl) throw new UserError("Sube un archivo o indica un enlace.");
    if (externalUrl && !/^https:\/\//.test(externalUrl)) throw new UserError("El enlace debe empezar por https://");
    let fileData: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number } | null = null;
    if (hasFile) {
      if (file.size > MAX_UPLOAD_BYTES) throw new UserError("El archivo supera el máximo de 200 MB.");
      const key = makeKey("private", `resources/${target}-${targetId}`, file.name);
      await putFile(key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
      fileData = { storageKey: key, fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size };
    }
    const r = await db.resource.create({
      data: {
        title: optStr(fd, "title") ?? (hasFile ? file.name : "Recurso"),
        description: optStr(fd, "description"),
        isPublic: bool(fd, "isPublic"),
        externalUrl: hasFile ? null : externalUrl,
        ...(fileData ?? {}),
        courseId: target === "course" ? targetId : null,
        moduleId: target === "module" ? targetId : null,
        lessonId: target === "lesson" ? targetId : null,
      },
    });
    await audit(user.id, "resource.create", r.id);
    refresh();
    return "Material añadido.";
  });
}

export async function deleteResourceAction(fd: FormData) {
  const user = await requireStaff();
  const id = str(fd, "id");
  const r = await db.resource.delete({ where: { id } });
  if (r.storageKey) await deleteFile(r.storageKey);
  await audit(user.id, "resource.delete", id, { title: r.title });
  refresh();
}

// ─────────── Cuestionarios ───────────

export async function updateQuizAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return run(async () => {
    const max = int(fd, "maxAttempts", 0);
    await db.quiz.update({
      where: { id: str(fd, "id") },
      data: {
        isExam: bool(fd, "isExam"),
        passingScore: clamp(int(fd, "passingScore", 70), 0, 100),
        maxAttempts: max > 0 ? max : null,
        showAnswers: bool(fd, "showAnswers"),
      },
    });
    refresh();
  });
}

export async function saveQuestionAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  return run(async () => {
    const quizId = str(fd, "quizId");
    const id = optStr(fd, "id");
    const text = z.string().min(3, "Escribe el enunciado de la pregunta").max(2000).parse(str(fd, "text"));
    const options: { text: string; isCorrect: boolean }[] = [];
    for (let i = 0; i < 8; i++) {
      const t = str(fd, `opt_${i}`);
      if (t) options.push({ text: t.slice(0, 500), isCorrect: bool(fd, `correct_${i}`) });
    }
    if (options.length < 2) throw new UserError("Añade al menos dos opciones de respuesta.");
    const correct = options.filter((o) => o.isCorrect).length;
    if (correct === 0) throw new UserError("Marca al menos una respuesta correcta.");
    const data = { text, explanation: optStr(fd, "explanation"), multiple: correct > 1, sortOrder: int(fd, "sortOrder") };
    await db.$transaction(async (tx) => {
      const q = id ? await tx.question.update({ where: { id }, data }) : await tx.question.create({ data: { ...data, quizId } });
      await tx.questionOption.deleteMany({ where: { questionId: q.id } });
      await tx.questionOption.createMany({ data: options.map((o, i) => ({ ...o, questionId: q.id, sortOrder: i })) });
    });
    refresh();
    return id ? "Pregunta actualizada." : "Pregunta añadida.";
  });
}

export async function deleteQuestionAction(fd: FormData) {
  await requireStaff();
  await db.question.delete({ where: { id: str(fd, "id") } });
  refresh();
}
