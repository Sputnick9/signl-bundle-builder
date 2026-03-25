// Build script for the SiGNL Bundle Discount Shopify Function.
// Uses the Shopify JavaScript runtime (api_version 2024-04) — no WASM/Javy needed.
// The function just exports a `run` function; Shopify's runtime handles I/O.
// Run via: npm run build (called automatically by `shopify app deploy`)

import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: "dist/function.js",
  format: "esm",
  target: "es2022",
});

console.log("Built dist/function.js");
