/**
 * Datos iniciales ESTRUCTURALES (no se crean cursos ni contenido ficticio):
 *  - Las 7 áreas de formación de JND como categorías.
 *  - Los niveles de membresía Esencial y Completa, SIN precio y NO activos.
 * Es idempotente: se puede ejecutar varias veces sin duplicar.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CATEGORIES = [
  ["Educación financiera", "educacion-financiera"],
  ["Bitcoin y criptomonedas", "bitcoin-y-criptomonedas"],
  ["Mercados financieros", "mercados-financieros"],
  ["Inversión", "inversion"],
  ["Análisis técnico y fundamental", "analisis-tecnico-y-fundamental"],
  ["Gestión del riesgo", "gestion-del-riesgo"],
  ["Mentalidad y desarrollo personal", "mentalidad-y-desarrollo-personal"],
] as const;

async function main() {
  for (const [i, [name, slug]] of CATEGORIES.entries()) {
    await db.category.upsert({ where: { slug }, update: {}, create: { name, slug, sortOrder: (i + 1) * 10, status: "PUBLISHED" } });
  }
  await db.membershipPlan.upsert({
    where: { slug: "esencial" },
    update: {},
    create: { name: "Esencial", slug: "esencial", sortOrder: 10, isActive: false, allowDownloads: true, allowCertificates: false },
  });
  await db.membershipPlan.upsert({
    where: { slug: "completa" },
    update: {},
    create: { name: "Completa", slug: "completa", sortOrder: 20, isActive: false, includesAllCourses: true, allowDownloads: true, allowCertificates: true },
  });
  console.log("Datos iniciales listos: 7 categorías y 2 niveles de membresía (inactivos, sin precio).");
}

main().finally(() => db.$disconnect());
