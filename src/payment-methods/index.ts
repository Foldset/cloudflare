import type { Context } from "hono";
import type { Env } from "../types";

import type { PaymentMethod } from "@foldset/core";

const CACHE_TTL_MS = 30_000;

let cachedPaymentMethods: PaymentMethod[] | null = null;
let cacheTimestamp = 0;

export async function getPaymentMethods(
  c: Context<{ Bindings: Env }>
): Promise<PaymentMethod[] | null> {
  const now = Date.now();
  if (cachedPaymentMethods !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPaymentMethods;
  }

  const response = await c.env.FOLDSET_CONFIG.get("payment-methods");
  cachedPaymentMethods = response ? JSON.parse(response) : null;
  cacheTimestamp = now;
  return cachedPaymentMethods;
}

export async function storePaymentMethods(
  c: Context<{ Bindings: Env }>,
  paymentMethods: PaymentMethod[]
): Promise<void> {
  await c.env.FOLDSET_CONFIG.put("payment-methods", JSON.stringify(paymentMethods), {
    expirationTtl: 60 * 60 * 3 + 60 * 30, // 3 hours + 30 minutes
  });
}
