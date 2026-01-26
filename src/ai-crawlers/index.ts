import type { Context } from "hono";
import type { Env } from "../types";

import type { AiCrawler } from "@foldset/core";

const CACHE_TTL_MS = 30_000;

let cachedAiCrawlers: AiCrawler[] = [];
let cacheTimestamp = 0;

export async function getAiCrawlers(
  c: Context<{ Bindings: Env }>
): Promise<AiCrawler[]> {
  const now = Date.now();
  if (cachedAiCrawlers.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAiCrawlers;
  }

  const response = await c.env.FOLDSET_CONFIG.get("ai-crawlers");
  const parsed: AiCrawler[] = response ? JSON.parse(response) : [];
  cachedAiCrawlers = parsed.map((c) => ({ user_agent: c.user_agent.toLowerCase() }));
  cacheTimestamp = now;
  return cachedAiCrawlers;
}

export async function storeAiCrawlers(
  c: Context<{ Bindings: Env }>,
  aiCrawlers: AiCrawler[]
): Promise<void> {
  await c.env.FOLDSET_CONFIG.put("ai-crawlers", JSON.stringify(aiCrawlers), {
    expirationTtl: 60 * 60 * 3 + 60 * 30, // 3 hours + 30 minutes
  });
}

export async function isAiCrawler(
  c: Context<{ Bindings: Env }>): Promise<boolean> {
  const aiCrawlers = await getAiCrawlers(c);
  const userAgent = c.req.header("User-Agent")?.toLowerCase();
  if (!userAgent) return false;
  return aiCrawlers.some((crawler) => userAgent.includes(crawler.user_agent));
}
