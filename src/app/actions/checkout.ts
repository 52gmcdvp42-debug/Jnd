"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { BillingError, createProductCheckout, createSubscriptionCheckout } from "@/lib/billing";
import { stripeEnabled } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "@/components/ui/Form";

const schema = z.object({
  kind: z.enum(["course", "module", "plan"]),
  id: z.string().min(1).max(50),
  interval: z.enum(["MONTH", "YEAR"]).optional(),
  back: z.string().max(200).optional(),
});

export async function checkoutAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Solicitud no válida." };
  const user = await getCurrentUser();
  if (!user) {
    const back = parsed.data.back?.startsWith("/") ? parsed.data.back : "/cursos";
    redirect(`/entrar?next=${encodeURIComponent(back)}`);
  }
  if (!stripeEnabled()) return { error: "Los pagos todavía no están activados en la plataforma." };
  if (!(await rateLimit(`checkout:${user.id}`, 20, 3600))) return { error: "Demasiados intentos. Inténtalo más tarde." };

  let url: string;
  try {
    const { kind, id, interval } = parsed.data;
    if (kind === "course") url = await createProductCheckout(user, { courseId: id });
    else if (kind === "module") url = await createProductCheckout(user, { moduleId: id });
    else url = await createSubscriptionCheckout(user, id, interval ?? "MONTH");
  } catch (e) {
    if (e instanceof BillingError) return { error: e.message };
    console.error("checkout", e);
    return { error: "No se ha podido iniciar el pago. Inténtalo de nuevo." };
  }
  redirect(url);
}
