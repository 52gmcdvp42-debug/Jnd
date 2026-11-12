import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

export function stripeEnabled() {
  return !!env.stripe.secretKey;
}

export function getStripe(): Stripe {
  if (!env.stripe.secretKey) throw new Error("Stripe no está configurado (STRIPE_SECRET_KEY)");
  client ??= new Stripe(env.stripe.secretKey, { appInfo: { name: "JND Academy" } });
  return client;
}
