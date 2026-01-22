import type { Context } from "hono";
import type { Env } from "../types";
import { HTTPFacilitatorClient } from "@x402/core/server";

export interface FacilitatorConfig {
  url: string;
  verifyHeaders?: Record<string, string>;
  settleHeaders?: Record<string, string>;
  supportedHeaders?: Record<string, string>;
}

const CACHE_TTL_MS = 30_000;

let cachedFacilitator: HTTPFacilitatorClient | null = null;
let cacheTimestamp = 0;

export async function getFacilitator(
  c: Context<{ Bindings: Env }>
): Promise<HTTPFacilitatorClient | null> {
  const now = Date.now();
  if (cachedFacilitator && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedFacilitator;
  }

  const response = await c.env.FOLDSET_CONFIG.get("facilitator");
  const facilitatorConfig: FacilitatorConfig | null = response ? JSON.parse(response) : null;
  if (!facilitatorConfig) {
    return null;
  }

  const hasAuthHeaders =
    facilitatorConfig.verifyHeaders ||
    facilitatorConfig.settleHeaders ||
    facilitatorConfig.supportedHeaders;


  cachedFacilitator = new HTTPFacilitatorClient({
    url: facilitatorConfig.url,
    ...(hasAuthHeaders && {
      createAuthHeaders: async () => ({
        verify: facilitatorConfig.verifyHeaders ?? {},
        settle: facilitatorConfig.settleHeaders ?? {},
        supported: facilitatorConfig.supportedHeaders ?? {},
      }),
    }),
  });
  cacheTimestamp = now;
  return cachedFacilitator;
}

export async function storeFacilitator(
  c: Context<{ Bindings: Env }>,
  facilitatorConfig: FacilitatorConfig
): Promise<void> {
  await c.env.FOLDSET_CONFIG.put("facilitator", JSON.stringify(facilitatorConfig), {
    expirationTtl: 60 * 60 * 3 + 60 * 30, // 3 hours + 30 minutes
  });
}
