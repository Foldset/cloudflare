import type { Context } from "hono";
import {
  x402ResourceServer,
  x402HTTPResourceServer,
} from "@x402/hono";
import type { PaywallProvider, PaywallConfig, PaymentRequired } from "@x402/hono";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import type { UnpaidResponseResult, HTTPResponseInstructions } from "@x402/core/http";

import type { Env } from "../types";
import type { Restriction, PaymentMethod } from "@foldset/core";
import { buildRoutesConfig, generatePaywallHtml } from "@foldset/core";
import { getRestrictions } from "../restrictions";
import { getPaymentMethods } from "../payment-methods";
import { getFacilitator } from "../facilitators";

const paywallProvider: PaywallProvider = {
  generateHtml: generatePaywallHtml
};

let cachedHttpServer: x402HTTPResourceServer | null = null;
let cachedRestrictions: Restriction[] | null = null;
let cachedPaymentMethods: PaymentMethod[] | null = null;

/**
 * Custom createHTTPResponse implementation for Foldset
 * Monkey-patched onto x402HTTPResourceServer instances
 */
function createFoldsetHTTPResponse(
  this: x402HTTPResourceServer,
  paymentRequired: PaymentRequired,
  isWebBrowser: boolean,
  paywallConfig?: PaywallConfig,
  customHtml?: string,
  unpaidResponse?: UnpaidResponseResult,
): HTTPResponseInstructions {
  // @ts-expect-error - accessing private method
  const html = this.generatePaywallHTML(paymentRequired, paywallConfig, customHtml);
  // Always generate and provide
  // if (isWebBrowser) {
  //   // @ts-expect-error - accessing private method
  //   const html = this.generatePaywallHTML(paymentRequired, paywallConfig, customHtml);
  //   return {
  //     status: 402,
  //     headers: { "Content-Type": "text/html" },
  //     body: html,
  //     isHtml: true,
  //   };
  // }

  // @ts-expect-error - accessing private method
  const response = this.createHTTPPaymentRequiredResponse(paymentRequired);

  // We don't provide a callback
  // Use callback result if provided, otherwise default to JSON with empty object
  // const contentType = unpaidResponse ? unpaidResponse.contentType : "application/json";
  // const body = unpaidResponse ? unpaidResponse.body : {};

  // Status should be 402 but we return 200 so AI crawlers view the payment instructions
  return {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      ...response.headers,
    },
    body: html,
    isHtml: true,
  };
}

// Maybe this function is never needed and can just updated cachedHttpServer on changes to upstream configs
// ie consider changing to a chained pattern
export async function getHttpServer(
  c: Context<{ Bindings: Env }>
): Promise<x402HTTPResourceServer | null> {
  const restrictions = await getRestrictions(c);
  const paymentMethods = await getPaymentMethods(c);
  if (restrictions === null || paymentMethods === null) {
    return null;
  }

  if (
    cachedHttpServer &&
    restrictions === cachedRestrictions &&
    paymentMethods === cachedPaymentMethods
  ) {
    return cachedHttpServer;
  }

  const facilitator = await getFacilitator(c);
  if (facilitator === null) {
    return null;
  }

  // This could be pulled out
  const server = new x402ResourceServer(facilitator);
  registerExactEvmScheme(server);
  registerExactSvmScheme(server);

  const routesConfig = buildRoutesConfig(restrictions, paymentMethods);
  const httpServer = new x402HTTPResourceServer(server, routesConfig);

  // Monkey-patch createHTTPResponse with our custom implementation
  // @ts-expect-error - overriding private method
  httpServer.createHTTPResponse = createFoldsetHTTPResponse;
  // TODO rfradkin: This is probably the slowest part of the cold start. Figure out how to speed this up.
  // Also this is slow on every request where its updated.
  // Consider looking into creating a serverless facilitator so don't have to request outside the serverless environment
  await httpServer.initialize();
  httpServer.registerPaywallProvider(paywallProvider)

  cachedHttpServer = httpServer;
  cachedRestrictions = restrictions;
  cachedPaymentMethods = paymentMethods;

  return httpServer;
}
