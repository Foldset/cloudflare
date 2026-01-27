import * as Sentry from "@sentry/cloudflare";
import type { ExecutionContext } from "@cloudflare/workers-types";
import type { ErrorReporter } from "@foldset/core";

const SENTRY_DSN =
  "https://f68380669974dab9bbcf5aec9414bcb8@o4510648631296000.ingest.us.sentry.io/4510718170038272";

type SentryWrapperArgs = {
  request: Request;
  context: ExecutionContext;
};

export function createSentryErrorReporter(): ErrorReporter {
  return {
    captureException(error: unknown, extra?: Record<string, unknown>) {
      Sentry.captureException(error, { extra });
    },
  };
}

// TODO rfradkin: Add webhook support for updating this
function createWrappedPaymentHandler(dsn?: string) {
  return (
    wrapperArgs: SentryWrapperArgs,
    handler: () => Promise<Response>
  ) => {
    if (!dsn) {
      return handler();
    }

    return Sentry.wrapRequestHandler(
      {
        options: {
          dsn,
          sendDefaultPii: true,
        },
        request:
          wrapperArgs.request as Parameters<
            typeof Sentry.wrapRequestHandler
          >[0]["request"],
        context: wrapperArgs.context,
      },
      handler
    );
  };
}

export const wrappedPaymentHandler = createWrappedPaymentHandler(SENTRY_DSN);
