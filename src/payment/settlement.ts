import * as Sentry from "@sentry/cloudflare";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import type { x402HTTPResourceServer } from "@x402/core/server";
import type { Context } from "hono";

import type { Env } from "../types";

export async function handleSettlement(
  c: Context<{ Bindings: Env }>,
  httpServer: x402HTTPResourceServer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  res: Response
): Promise<Response> {
  if (res.status >= 400) {
    return res;
  }

  try {
    const settleResult = await httpServer.processSettlement(
      paymentPayload,
      paymentRequirements
    );
    if (!settleResult.success) {
      Sentry.captureException(new Error(`Settlement failed: ${settleResult.errorReason}`));
      return c.json(
        {
          error: "Settlement failed",
          details: settleResult.errorReason,
        },
        402
      );
    }

    Object.entries(settleResult.headers).forEach(([key, value]) => {
      res.headers.set(key, value);
    });
    return res;
  } catch (error) {
    Sentry.captureException(error);
    return c.json(
      {
        error: "Settlement failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      402
    );
  }
}
