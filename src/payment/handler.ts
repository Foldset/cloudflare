import { HTTPRequestContext } from "@x402/core/server";
import type { HTTPResponseInstructions } from "@x402/core/http";
import type { Context } from "hono";
import * as Sentry from "@sentry/cloudflare";

import type { Env } from "../types";
import { handleWebhook } from "../webhooks";
import { logVisitEvent } from "../telemetry/logging";
import { wrappedPaymentHandler } from "../telemetry/sentry";
import { HonoAdapter } from "./adapter";
import { getHttpServer } from "./setup";
import { handleSettlement } from "./settlement";
import { isAiCrawler } from "../ai-crawlers";

function createPaymentContext(
  c: Context<{ Bindings: Env }>): HTTPRequestContext {
  const adapter = new HonoAdapter(c);
  return {
    adapter,
    path: c.req.path,
    method: c.req.method,
    paymentHeader: adapter.getHeader("PAYMENT-SIGNATURE") || adapter.getHeader("X-PAYMENT"),
  };
}

// TODO rfradkin: Open a PR in x402 github to change the handlePaymentError to protected or allow for passing parameteres to specify
// this behavior
function handlePaymentError(
  c: Context<{ Bindings: Env }>,
  response: HTTPResponseInstructions
): Response {
  Object.entries(response.headers).forEach(([key, value]) => {
    c.header(key, value);
  });

  // We always return a 200 even though the status code is 402
  // AI crawlers tend to view the raw html only if a 200 is returned
  // For now, we will return 200 errors while blocking the content even though 
  // we should be returning response.status as 402 here 
  // We also provide the headers and html to everyone, regardless of web browser status

  // ok just 402 for now
  return c.html(response.body as string, response.status as 402);
  // if (response.isHtml) {
  //   return c.html(response.body as string, response.status as 402));
  // }
  // return c.json(response.body || {}, response.status as 402);
}

async function paymentHandlerHelper(c: Context<{ Bindings: Env }>): Promise<Response> {
  if (!c.env.FOLDSET_API_KEY) {
    throw new Error("Missing required environment variable: FOLDSET_API_KEY. See https://docs.foldset.com/setup");
  }
  if (!c.env.FOLDSET_CONFIG) {
    throw new Error("Missing required KV namespace binding: FOLDSET_CONFIG. See https://docs.foldset.com/setup");
  }

  Sentry.setTag("url", c.req.url);
  Sentry.setTag("path", c.req.path);
  Sentry.setTag("method", c.req.method);

  if (c.req.method === "POST" && c.req.path === "/foldset/webhooks") {
    return handleWebhook(c);
  }

  if (!(await isAiCrawler(c))) {
    return await fetch(c.req.raw);
  }

  const httpServer = await getHttpServer(c);

  if (!httpServer) {
    return await fetch(c.req.raw);
  }

  const context = createPaymentContext(c);

  if (!httpServer.requiresPayment(context)) {
    return await fetch(c.req.raw);
  }

  const result = await httpServer.processHTTPRequest(context);

  if (result.type === "no-payment-required") {
    const response = await fetch(c.req.raw);
    logVisitEvent(c, response);
    return response;
  }

  if (result.type === "payment-error") {
    const response = handlePaymentError(c, result.response);
    logVisitEvent(c, response);
    return response;
  }

  const { paymentPayload, paymentRequirements } = result;
  const upstreamResponse = await fetch(c.req.raw);
  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: new Headers(upstreamResponse.headers),
  });

  const settledResponse = await handleSettlement(
    c,
    httpServer,
    paymentPayload,
    paymentRequirements,
    response
  );
  logVisitEvent(c, settledResponse);
  return settledResponse;
}

export function paymentHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  return wrappedPaymentHandler(
    {
      request: c.req.raw,
      context: c.executionCtx,
    },
    () => paymentHandlerHelper(c)
  );
}
