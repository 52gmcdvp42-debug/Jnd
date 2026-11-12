"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { saveSetting } from "@/lib/settings";
import { LEGAL_SLUGS } from "@/lib/legal-defaults";
import { audit } from "@/lib/audit";
import { run, str, bool } from "./_util";
import type { FormState } from "@/components/ui/Form";

export async function saveGeneralSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return run(async () => {
    const email = str(fd, "contactEmail");
    if (email) z.string().email("Email de contacto no válido").parse(email);
    await saveSetting("general", {
      siteName: str(fd, "siteName") || "JND",
      slogan: str(fd, "slogan"),
      secondarySlogan: str(fd, "secondarySlogan"),
      contactEmail: email,
      heroTitle: str(fd, "heroTitle"),
      heroText: str(fd, "heroText"),
      aboutText: str(fd, "aboutText"),
      registrationOpen: bool(fd, "registrationOpen"),
      requireEmailVerification: bool(fd, "requireEmailVerification"),
    });
    await audit(user.id, "settings.general");
    revalidatePath("/", "layout");
  });
}

export async function saveCompanySettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return run(async () => {
    await saveSetting("company", { legalName: str(fd, "legalName"), taxId: str(fd, "taxId"), address: str(fd, "address"), email: str(fd, "email"), registry: str(fd, "registry") });
    await saveSetting("certificate", { signerName: str(fd, "signerName"), signerTitle: str(fd, "signerTitle") });
    await audit(user.id, "settings.company");
    revalidatePath("/", "layout");
  });
}

export async function saveLegalPageAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAdmin();
  return run(async () => {
    const slug = z.enum(LEGAL_SLUGS).parse(str(fd, "slug"));
    await saveSetting(`legal:${slug}`, { title: z.string().min(2).max(120).parse(str(fd, "title")), body: z.string().max(100_000).parse(str(fd, "body")) });
    await audit(user.id, "settings.legal", slug);
    revalidatePath(`/legal/${slug}`);
  });
}
