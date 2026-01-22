import type { Context } from "hono";
import type { Env } from "../types";

export interface Restriction {
  host: string;
  path: string;
  description: string;
  price: number;
  scheme: string;
}

const CACHE_TTL_MS = 30_000;

let cachedRestrictions: Restriction[] | null = null;
let cacheTimestamp = 0;

export async function getRestrictions(
  c: Context<{ Bindings: Env }>
): Promise<Restriction[] | null> {
  const now = Date.now();
  if (cachedRestrictions !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRestrictions;
  }

  const response = await c.env.FOLDSET_CONFIG.get("restrictions");
  cachedRestrictions = response ? JSON.parse(response) : null;
  cacheTimestamp = now;
  return cachedRestrictions;
}

export async function storeRestrictions(
  c: Context<{ Bindings: Env }>,
  restrictions: Restriction[]
): Promise<void> {
  await c.env.FOLDSET_CONFIG.put("restrictions", JSON.stringify(restrictions), {
    expirationTtl: 60 * 60 * 3 + 60 * 30, // 3 hours + 30 minutes
  });
}
