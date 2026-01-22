import type { Context } from "hono";

import type { Env } from "../types";
import { type Restriction, storeRestrictions } from "../restrictions";
import { type PaymentMethod, storePaymentMethods } from "../payment-methods";
import { type AiCrawler, storeAiCrawlers } from "../ai-crawlers";
import { type FacilitatorConfig, storeFacilitator } from "../facilitators";

export type FoldsetWebhook =
  | { event_type: "restrictions"; event_object: Restriction[] }
  | { event_type: "payment-methods"; event_object: PaymentMethod[] }
  | { event_type: "ai-crawlers"; event_object: AiCrawler[] }
  | { event_type: "facilitator"; event_object: FacilitatorConfig };

async function verifySignature(body: string, signature: string, apiKey: string): Promise<boolean> {
  const encoder = new TextEncoder();

  const keyHashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const hashedKeyHex = Array.from(new Uint8Array(keyHashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(hashedKeyHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expectedSig = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return result === 0;
}

export async function handleWebhook(c: Context<{ Bindings: Env }>): Promise<Response> {
  const signature = c.req.header("X-Foldset-Signature");
  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const body = await c.req.text();
  const isValid = await verifySignature(body, signature, c.env.FOLDSET_API_KEY);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const webhook = JSON.parse(body) as FoldsetWebhook;

  // Fails the entire webhook if the put fails. Not standard but think it makes sense for now
  if (webhook.event_type === "restrictions") {
    await storeRestrictions(c, webhook.event_object as Restriction[]);
  } else if (webhook.event_type === "payment-methods") {
    await storePaymentMethods(c, webhook.event_object as PaymentMethod[]);
  } else if (webhook.event_type === "ai-crawlers") {
    await storeAiCrawlers(c, webhook.event_object as AiCrawler[]);
  } else if (webhook.event_type === "facilitator") {
    await storeFacilitator(c, webhook.event_object as FacilitatorConfig);
  }

  return new Response("Ok", { status: 200 });
}
