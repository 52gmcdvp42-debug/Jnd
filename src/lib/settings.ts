import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { LEGAL_DEFAULTS, type LegalSlug } from "@/lib/legal-defaults";

export type GeneralSettings = {
  siteName: string;
  slogan: string;
  secondarySlogan: string;
  contactEmail: string;
  heroTitle: string;
  heroText: string;
  aboutText: string;
  registrationOpen: boolean;
  requireEmailVerification: boolean;
};

export type CompanySettings = {
  legalName: string;
  taxId: string;
  address: string;
  email: string;
  registry: string;
};

export type CertificateSettings = { signerName: string; signerTitle: string };

export const DEFAULT_GENERAL: GeneralSettings = {
  siteName: "JND",
  slogan: "THINK. LEARN. LEAD.",
  secondarySlogan: "THE FUTURE STARTS HERE.",
  contactEmail: "",
  heroTitle: "Educación financiera para tomar decisiones con criterio",
  heroText:
    "Formación online en finanzas personales, Bitcoin, mercados, inversión, análisis y gestión del riesgo. Aprende a tu ritmo, desde cualquier dispositivo.",
  aboutText:
    "JND es una academia online especializada en educación financiera. Nuestro objetivo es ayudarte a entender los mercados, la inversión y el mundo de Bitcoin con rigor, método y una mentalidad orientada al largo plazo.",
  registrationOpen: true,
  requireEmailVerification: false,
};

export const DEFAULT_COMPANY: CompanySettings = { legalName: "", taxId: "", address: "", email: "", registry: "" };
export const DEFAULT_CERTIFICATE: CertificateSettings = { signerName: "", signerTitle: "Dirección académica" };

async function get<T extends object>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  return { ...fallback, ...((row?.value as object) ?? {}) } as T;
}

export const getGeneralSettings = cache(() => get("general", DEFAULT_GENERAL));
export const getCompanySettings = cache(() => get("company", DEFAULT_COMPANY));
export const getCertificateSettings = cache(() => get("certificate", DEFAULT_CERTIFICATE));

export async function getLegalPage(slug: LegalSlug): Promise<{ title: string; body: string; updatedAt: Date | null }> {
  const row = await db.setting.findUnique({ where: { key: `legal:${slug}` } });
  const def = LEGAL_DEFAULTS[slug];
  const v = (row?.value as { title?: string; body?: string } | undefined) ?? {};
  return { title: v.title || def.title, body: v.body || def.body, updatedAt: row?.updatedAt ?? null };
}

export async function saveSetting(key: string, value: object) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
