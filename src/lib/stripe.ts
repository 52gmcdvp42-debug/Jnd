import "server-only";
import Stripe from "stripe";
import { HttpsProxyAgent } from "https-proxy-agent";
import { env } from "@/lib/env";

let client: Stripe | null = null;

export function stripeEnabled() {
  return !!env.stripe.secretKey;
}

export function getStripe(): Stripe {
  if (!env.stripe.secretKey) throw new Error("Stripe no está configurado (STRIPE_SECRET_KEY)");
  // Si el servidor sale a internet a través de un proxy (HTTPS_PROXY), Stripe lo usa
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  client ??= new Stripe(env.stripe.secretKey, {
    appInfo: { name: "JND Academy" },
    ...(proxy ? { httpAgent: new HttpsProxyAgent(proxy) } : {}),
  });
  return client;
}
