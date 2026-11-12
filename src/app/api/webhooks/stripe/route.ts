import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/billing";

/**
 * Webhook de Stripe. ÚNICA vía por la que se conceden accesos tras un pago.
 * Se verifica la firma con STRIPE_WEBHOOK_SECRET; cualquier petición sin firma válida se rechaza.
 */
export async function POST(req: Request) {
  const secret = env.stripe.webhookSecret;
  if (!secret) return new NextResponse("Webhook no configurado", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Falta firma", { status: 400 });
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await Stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return new NextResponse("Firma no válida", { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (e) {
    console.error("Error procesando webhook", event.type, event.id, e);
    return new NextResponse("Error interno", { status: 500 }); // Stripe reintentará
  }
}
