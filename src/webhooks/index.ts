import type { Context } from "hono";

import type { Env } from "../types";
import type { Restriction, PaymentMethod, AiCrawler, FacilitatorConfig, FoldsetWebhook } from "@foldset/core";
import { verifySignature } from "@foldset/core";
import { storeRestrictions } from "../restrictions";
import { storePaymentMethods } from "../payment-methods";
import { storeAiCrawlers } from "../ai-crawlers";
import { storeFacilitator } from "../facilitators";


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
