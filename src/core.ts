import type { Context } from "hono";
import { WorkerCore } from "@foldset/core";
import type { ErrorReporter } from "@foldset/core";

import type { Env } from "./types";
import { createKVStore } from "./store";
import { createSentryErrorReporter } from "./telemetry/sentry";

let cachedCore: WorkerCore | null = null;

export function getWorkerCore(c: Context<{ Bindings: Env }>, errorReporter?: ErrorReporter): WorkerCore {
  if (cachedCore) return cachedCore;

  if (!c.env.FOLDSET_API_KEY) {
    throw new Error(
      "Missing required environment variable: FOLDSET_API_KEY. See https://docs.foldset.com/setup",
    );
  }
  if (!c.env.FOLDSET_CONFIG) {
    throw new Error(
      "Missing required KV namespace binding: FOLDSET_CONFIG. See https://docs.foldset.com/setup",
    );
  }

  const store = createKVStore(c.env.FOLDSET_CONFIG);
  cachedCore = new WorkerCore(store, {
    apiKey: c.env.FOLDSET_API_KEY,
    errorReporter: errorReporter ?? createSentryErrorReporter(),
  });

  return cachedCore;
}
