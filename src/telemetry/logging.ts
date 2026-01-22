import type { Context } from "hono";
import * as Sentry from "@sentry/cloudflare";

import { API_BASE_URL } from "../config";
import type { Env } from "../types";

const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

export type EventPayload = {
  method: string;
  status_code: number;
  user_agent: string | null;
  referer?: string | null;
  href: string;
  hostname: string;
  pathname: string;
  search: string;
  ip_address?: string | null;
  payment_response?: string;
};

export function logVisitEvent(c: Context<{ Bindings: Env }>, response: Response) {
  const url = new URL(c.req.url);
  const ipAddressHeader = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for");
  const ipAddress = ipAddressHeader?.split(",")[0]?.trim() || null;
  const paymentResponse = response.headers.get(PAYMENT_RESPONSE_HEADER) || undefined;

  const payload: EventPayload = {
    method: c.req.method,
    status_code: response.status,
    user_agent: c.req.header("user-agent") || null,
    referer: c.req.header("referer") || null,
    href: url.href,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    ip_address: ipAddress,
    ...(paymentResponse ? { payment_response: paymentResponse } : {}),
  };

  const requestPromise = fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.FOLDSET_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    Sentry.captureException(error, {
      extra: {
        method: "POST",
        url: `${API_BASE_URL}/events`,
        headers: {
          Authorization: `Bearer ${c.env.FOLDSET_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      tags: {
        endpoint: "/events",
      },
    });
  });

  c.executionCtx.waitUntil(requestPromise);
}
