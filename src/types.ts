import type { KVNamespace } from "@cloudflare/workers-types";

export type Env = {
  FOLDSET_API_KEY: string;
  FOLDSET_CONFIG: KVNamespace;
};
