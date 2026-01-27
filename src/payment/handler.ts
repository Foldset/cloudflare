import type { Context } from "hono";
import {
  handlePaymentRequest,
  handleSettlement,
  handleWebhookRequest,
} from "@foldset/core";

import type { Env } from "../types";
import { getWorkerCore } from "../core";
import { HonoAdapter } from "./adapter";
import { wrappedPaymentHandler } from "../telemetry/sentry";

async function paymentHandlerHelper(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  const core = getWorkerCore(c);
  const adapter = new HonoAdapter(c);

  if (c.req.method === "POST" && c.req.path === "/foldset/webhooks") {
    const result = await handleWebhookRequest(
      core,
      adapter,
      await c.req.text(),
    );
    return new Response(result.body, { status: result.status });
  }

  const httpServer = await core.httpServer.get();
  if (!httpServer) {
    return fetch(c.req.raw);
  }

  const result = await handlePaymentRequest(core, httpServer, adapter);

  switch (result.type) {
    case "no-payment-required":
      return fetch(c.req.raw);

    case "payment-error":
      return new Response(result.response.body as string, {
        status: result.response.status,
        headers: result.response.headers,
      });

    case "payment-verified": {
      const upstream = await fetch(c.req.raw);

      const settlement = await handleSettlement(
        core,
        httpServer,
        adapter,
        result.paymentPayload,
        result.paymentRequirements,
        upstream.status,
      );

      if (!settlement.success) {
        return new Response(
          JSON.stringify({
            error: "Settlement failed",
            details: settlement.errorReason,
          }),
          {
            status: 402,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const response = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: new Headers(upstream.headers),
      });
      for (const [key, value] of Object.entries(settlement.headers)) {
        response.headers.set(key, value);
      }
      return response;
    }
  }
}

export function paymentHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  return wrappedPaymentHandler(
    {
      request: c.req.raw,
      context: c.executionCtx,
    },
    () => paymentHandlerHelper(c),
  );
}
