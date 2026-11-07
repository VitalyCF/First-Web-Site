import media from "../media.json" with { type: "json" };
import transfer from "./transfer.json" with { type: "json" };

const source = "https://vitaly-kirshchenya.vkirshch.chatgpt.site";
const allowedHeaders = {
  "Access-Control-Allow-Origin": source,
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Transfer-Signature",
  "Cache-Control": "no-store"
};

function reply(status) {
  return new Response(null, { status, headers: allowedHeaders });
}

export async function receivePhoto(request, env, key) {
  if (Date.now() > transfer.expires || request.headers.get("Origin") !== source) return reply(403);
  if (!Object.hasOwn(media, key)) return reply(404);
  if (request.method === "OPTIONS") return reply(204);
  if (request.method !== "PUT") return reply(405);
  const item = media[key];
  const signature = request.headers.get("X-Transfer-Signature") || "";
  if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) return reply(403);
  const pub = await crypto.subtle.importKey("jwk", transfer.publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const statement = new TextEncoder().encode([key, item.sha256, transfer.expires].join("|"));
  const valid = await crypto.subtle.verify({name: "ECDSA", hash: "SHA-256"}, pub, Uint8Array.from(atob(signature), c=>c.charCodeAt(0)), statement);
  if (!valid) return reply(403);
  if (request.headers.get("Content-Length") !== String(item.bytes)) return reply(400);
  const data = await request.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest), b=>b.toString(16).padStart(2,"0")).join("");
  if (hex !== item.sha256 || data.byteLength !== item.bytes) return reply(422);
  await env.PHOTOS.put(key, data, {sha256: digest, httpMetadata: {contentType: "image/webp"}});
  return reply(204);
}
