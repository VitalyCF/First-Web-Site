import media from "../media.json" with { type: "json" };

import { receivePhoto } from "./migrate.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/__photo-transfer/")) return receivePhoto(request, env, url.pathname.slice("/__photo-transfer/".length));
    if (!url.pathname.startsWith("/media/")) return env.ASSETS.fetch(request);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const key = url.pathname.slice("/media/".length);
    if (!Object.hasOwn(media, key)) return new Response(null, { status: 404 });

    const item = media[key];
    const etag = '"' + item.sha256 + '"';
    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/webp",
      "Content-Length": String(item.bytes),
      "X-Content-Type-Options": "nosniff",
      "ETag": etag
    });

    // The object key includes its digest; query parameters do not change a photo.
    const cacheKey = new Request(url.origin + url.pathname);
    const cached = await caches.default.match(cacheKey);
    let object;
    if (!cached) {
      object = request.method === "HEAD" ? await env.PHOTOS.head(key) : await env.PHOTOS.get(key);
      if (!object) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const tags = (request.headers.get("If-None-Match") || "").split(",").map(tag => tag.trim().replace(/^W\//, ""));
    if (tags.includes(etag) || tags.includes("*")) {
      headers.delete("Content-Length");
      return new Response(null, { status: 304, headers });
    }
    if (request.method === "HEAD") return new Response(null, { headers });
    if (cached) return cached;

    const response = new Response(object.body, { headers });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  }
};
