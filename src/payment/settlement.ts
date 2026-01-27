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
  console.log("=== CLOUDFLARE SETTLEMENT ===");
  console.log("Response status:", res.status);
  console.log("paymentPayload:", JSON.stringify(paymentPayload, null, 2));
  console.log("paymentRequirements:", JSON.stringify(paymentRequirements, null, 2));

  if (res.status >= 400) {
    console.log("Upstream returned error, skipping settlement");
    return res;
  }

  try {
    console.log("Calling processSettlement...");
    const settleResult = await httpServer.processSettlement(
      paymentPayload,
      paymentRequirements
    );

    console.log("Settlement result:", {
      success: settleResult.success,
      errorReason: settleResult.success ? undefined : settleResult.errorReason,
      headers: settleResult.success ? settleResult.headers : undefined,
    });

    if (!settleResult.success) {
      console.error("Settlement failed:", settleResult.errorReason);
      Sentry.captureException(new Error(`Settlement failed: ${settleResult.errorReason}`));
      return c.json(
        {
          error: "Settlement failed",
          details: settleResult.errorReason,
        },
        402
      );
    }

    console.log("Settlement successful, adding headers");
    Object.entries(settleResult.headers).forEach(([key, value]) => {
      console.log(`  Adding header: ${key} = ${value}`);
      res.headers.set(key, value);
    });
    console.log("=== CLOUDFLARE SETTLEMENT COMPLETE ===");
    return res;
  } catch (error) {
    console.error("=== CLOUDFLARE SETTLEMENT ERROR ===");
    console.error("Error:", error);
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
