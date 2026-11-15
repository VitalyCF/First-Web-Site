import { build } from "esbuild";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { basename } from "node:path";

const outdir = "public/goals-media/build";
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
const bundle = await build({
  entryPoints: ["goals/entry.tsx"],
  outdir,
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  entryNames: "journal-[hash]",
  metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
const outputs = Object.entries(bundle.metafile.outputs);
const [script, meta] = outputs.find(([, output]) => output.entryPoint);
const base = "/goals-media/build/";
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#f8f7f3"><title>Kurs · Your year, with intention</title><link rel="icon" href="/goals-media/favicon.svg"><link rel="stylesheet" href="${base}${basename(meta.cssBundle)}"></head>
<body><div id="journal"></div><noscript>Enable JavaScript to open your journal.</noscript><script type="module" src="${base}${basename(script)}"></script></body></html>`;
await writeFile(outdir + "/index.html", html);
