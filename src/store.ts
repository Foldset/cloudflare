import type { ConfigStore } from "@foldset/core";

const KV_TTL = 60 * 60 * 3 + 60 * 30; // 3.5 hours

export function createKVStore(kv: KVNamespace): ConfigStore {
  return {
    async get(key) {
      return kv.get(key);
    },
    async put(key, value) {
      await kv.put(key, value, { expirationTtl: KV_TTL });
    },
  };
}
