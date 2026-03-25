// Build script for the SiGNL Bundle Discount Shopify Function.
// Uses the Shopify JavaScript runtime with @shopify/shopify_function for I/O.
// Run via: npm run build (called automatically by `shopify app deploy`)

import * as esbuild from "esbuild";

// Entry wraps the exported run function with @shopify/shopify_function I/O
const entryContent = `
import { shopifyFunction } from "@shopify/shopify_function";
import { run } from "./src/index.js";
shopifyFunction(run);
`;

await esbuild.build({
  stdin: {
    contents: entryContent,
    resolveDir: ".",
  },
  bundle: true,
  outfile: "dist/function.js",
  format: "esm",
  target: "es2022",
});

console.log("Built dist/function.js");
