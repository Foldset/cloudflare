import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: { worker: "src/bundle-entry.ts" },
  bundle: true,
  platform: "browser",
  target: "es2022",
  format: "esm",
  minify: true,
  outdir: "dist/bundle",
  outExtension: { ".js": ".js" },
  conditions: ["workerd", "worker", "browser"],
  // Cloudflare Workers runtime provides these Node.js built-ins natively
  external: ["node:async_hooks", "node:buffer", "node:crypto", "node:events", "node:util"],
});
