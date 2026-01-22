# @foldset/cloudflare

Cloudflare Workers middleware for monetizing AI traffic using the [x402 payment protocol](https://x402.org).

## Installation

```bash
npm install @foldset/cloudflare
# or
pnpm add @foldset/cloudflare
```

## Quick Start

```typescript
import { Hono } from "hono";
import { paymentHandler } from "@foldset/cloudflare/hono";

type Env = {
  FOLDSET_API_KEY: string;
  FOLDSET_CONFIG: KVNamespace;
};

const app = new Hono<{ Bindings: Env }>();

// Add Foldset payment handler
app.all("*", paymentHandler);

// Your routes
app.get("/api/data", (c) => {
  return c.json({ message: "Premium content" });
});

export default app;
```

## Environment Setup

Your Cloudflare Worker needs these bindings:

```toml
# wrangler.toml
[vars]
FOLDSET_API_KEY = "sk_live_..."

[[kv_namespaces]]
binding = "FOLDSET_CONFIG"
id = "your-kv-namespace-id"
```

Get your API key from the [Foldset Dashboard](https://foldset.com/dashboard/api-keys).

## How It Works

1. Requests hit your Cloudflare Worker
2. Foldset checks if the request is from an AI crawler
3. If yes and the route requires payment, returns HTTP 402 with payment options
4. Once paid, the request proceeds to your application
5. Non-AI traffic passes through unchanged

## Configuration

Configure protected routes and pricing in the [Foldset Dashboard](https://foldset.com/dashboard/routes). Changes sync automatically to your worker.

## Types

```typescript
import type {
  Env,
  Restriction,
  PaymentMethod,
  AiCrawler,
  FacilitatorConfig,
  FoldsetWebhook,
  EventPayload,
} from "@foldset/cloudflare";
```

## Documentation

Full documentation: [docs.foldset.com](https://docs.foldset.com)

## License

MIT
