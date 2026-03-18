// Build script for the SiGNL Bundle Discount Shopify Function.
// This bundles src/run.js into a single file then compiles it to WASM via Javy.
// Run via: npm run build (called automatically by `shopify app deploy`)

import * as esbuild from "esbuild";

// Javy WASM runtime entry point — wraps the exported `run` function with
// stdin/stdout I/O that the Shopify Functions runtime expects.
const entryContent = `
import { run } from "./src/index.js";
const inputData = JSON.parse(Shopify.readAllStdin());
const output = run(inputData);
Shopify.writeAllStdout(JSON.stringify(output));
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

console.log("Bundled dist/function.js — compile to WASM with: javy compile -d -i dist/function.js -o dist/index.wasm");
