import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import media from "../media.json" with { type: "json" };
import worker from "../src/worker.js";

test("all four pages link to published pages, local assets and registered photos", () => {
  const photos = new Set();
  for (const name of ["index", "projects", "work-notes", "outside-work"]) {
    const page = readFileSync("public/" + name + ".html", "utf8");
    assert.ok(page.includes("https://kirshchenya.com"));
    assert.ok(!page.includes("chatgpt.site"));
    for (const [, ref] of page.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(#|https?:|mailto:)/.test(ref)) continue;
      const path = new URL(ref, "https://kirshchenya.com/" + name).pathname;
      if (path.startsWith("/media/")) {
        const key = path.slice("/media/".length);
        assert.ok(Object.hasOwn(media, key), key);
        photos.add(key);
        continue;
      }
      const file = resolve("public", "." + (path === "/" ? "/index.html" : path));
      assert.ok(existsSync(file) || existsSync(file + ".html"), ref);
    }
  }
  assert.deepEqual([...photos].sort(), Object.keys(media).sort());
  for (const [key, item] of Object.entries(media)) {
    assert.ok(key.endsWith("." + item.sha256.slice(0, 16) + ".webp"));
    assert.ok(item.bytes > 0);
  }
  assert.ok(!readdirSync("public").some(path => path.endsWith(".zip")));
});

test("the photo route serves only registered images and uses its edge cache", async () => {
  const key = Object.keys(media)[0];
  const path = "https://kirshchenya.com/media/" + key;
  const cache = new Map();
  globalThis.caches = { default: {
    match: async req => cache.get(req.url)?.clone(),
    put: async (req, res) => cache.set(req.url, res)
  }};
  let reads = 0;
  const env = {
    PHOTOS: { head: async () => ({}), get: async () => { reads++; return { body: "image" }; } },
    ASSETS: { fetch: () => new Response("page") }
  };
  const tasks = [];
  const ctx = { waitUntil: task => tasks.push(task) };
  const fetch = (url, init) => worker.fetch(new Request(url, init), env, ctx);
  assert.equal(await (await fetch("https://kirshchenya.com/")).text(), "page");
  assert.equal((await fetch(path + "-missing")).status, 404);
  assert.equal((await fetch(path, { method: "POST" })).status, 405);
  assert.equal((await fetch(path, { method: "HEAD" })).body, null);
  const first = await fetch(path);
  assert.equal(await first.text(), "image");
  await Promise.all(tasks);
  assert.equal(await (await fetch(path + "?v=2")).text(), "image");
  assert.equal(reads, 1);
  const fresh = await fetch(path, {headers: {"If-None-Match": first.headers.get("ETag")}});
  assert.equal(fresh.status, 304);
  assert.equal(fresh.body, null);
  const missing = await worker.fetch(new Request("https://other.example/media/" + key), { PHOTOS: { get: async () => null } }, ctx);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("Cache-Control"), "no-store");
});
