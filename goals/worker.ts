import { loginMessage } from "./proof";
import { ownerPublicKey } from "./owner";
import { normalizePlanner, validPlanner } from "./planner";
import { json, headers, body, journal } from "./storage";
import { serviceRoute, extraTables } from "./service";
import { models, type AssistantEnv } from "./assistant";

const enc = new TextEncoder();
const sessionName = "__Host-kurs";
const maxAge = 60 * 60 * 24 * 90;
type Env = AssistantEnv & {
  ASSETS: { fetch: (r: Request) => Promise<Response> };
};
let initialized: Promise<void> | undefined;

function schema(db: D1Database) {
  if (!initialized)
    initialized = db
      .batch([
        ...extraTables.map((q) => db.prepare(q)),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS journal (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,content TEXT NOT NULL)",
        ),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS login_proofs (nonce TEXT PRIMARY KEY,expires INTEGER NOT NULL)",
        ),
        db.prepare(
          "CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY,expires INTEGER NOT NULL)",
        ),
      ])
      .then(() => {})
      .catch((e) => {
        initialized = undefined;
        throw e;
      });
  return initialized;
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
async function shell(env: Env, request: Request) {
  const url = new URL("/goals-media/build/", request.url);
  let asset = await env.ASSETS.fetch(new Request(url));
  if (asset.status >= 300 && asset.status < 400) {
    const location = new URL(
      asset.headers.get("location") || "/goals-media/build/",
      url,
    );
    if (
      location.origin !== url.origin ||
      !location.pathname.startsWith("/goals-media/build")
    )
      return json({ error: "shell" }, 503);
    asset = await env.ASSETS.fetch(new Request(location));
  }
  const h = new Headers(asset.headers);
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  h.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(request.method === "HEAD" ? null : asset.body, {
    status: asset.status,
    headers: h,
  });
}
export async function goalsFetch(
  request: Request,
  env: Env,
): Promise<Response> {
  const { pathname, origin } = new URL(request.url);
  if (pathname === "/" && ["GET", "HEAD"].includes(request.method))
    return shell(env, request);
  if (pathname.startsWith("/_astro/") || pathname.startsWith("/goals-media/"))
    return env.ASSETS.fetch(request);
  if (!pathname.startsWith("/api/kurs/"))
    return json({ error: "not_found" }, 404);
  if (request.method !== "GET" && request.headers.get("Origin") !== origin)
    return json({ error: "origin" }, 403);
  const path = pathname.slice("/api/kurs/".length);
  try {
    if (path === "health" && request.method === "GET")
      return json({
        app: "kurs",
        runtime: "cloudflare-workers",
        model: models.balanced,
        gateway: env.OPENAI_GATEWAY_ID,
        ai: !!env.GOALS_AI,
        storage: !!env.GOALS_DB,
      });
    await schema(env.GOALS_DB);
    const now = Math.floor(Date.now() / 1000);
    if (path === "login" && request.method === "POST") {
      const data = await body(request, 500);
      if (
        !Number.isSafeInteger(data.time) ||
        Math.abs(now - data.time) > 180 ||
        typeof data.nonce !== "string" ||
        !/^[a-f0-9-]{36}$/.test(data.nonce) ||
        typeof data.signature !== "string" ||
        !/^[A-Za-z0-9+/]{86}==$/.test(data.signature)
      )
        return json({ error: "invalid_key" }, 401);
      const der = ownerPublicKey.split("\n").slice(1, -1).join("");
      const pub = await crypto.subtle.importKey(
        "spki",
        Uint8Array.from(atob(der), (c) => c.charCodeAt(0)),
        "Ed25519",
        false,
        ["verify"],
      );
      const sig = Uint8Array.from(atob(data.signature), (c) => c.charCodeAt(0));
      if (
        !(await crypto.subtle.verify(
          "Ed25519",
          pub,
          sig,
          loginMessage(origin, data.time, data.nonce),
        ))
      )
        return json({ error: "invalid_key" }, 401);
      const once = await env.GOALS_DB.prepare(
        "INSERT OR IGNORE INTO login_proofs(nonce,expires) VALUES(?,?)",
      )
        .bind(data.nonce, data.time + 181)
        .run();
      if (once.meta.changes !== 1) return json({ error: "invalid_key" }, 401);
      const session = crypto.randomUUID() + crypto.randomUUID();
      await env.GOALS_DB.batch([
        env.GOALS_DB.prepare("DELETE FROM login_proofs WHERE expires<=?").bind(
          now,
        ),
        env.GOALS_DB.prepare("DELETE FROM sessions WHERE expires<=?").bind(now),
        env.GOALS_DB.prepare(
          "INSERT INTO sessions(digest,expires) VALUES(?,?)",
        ).bind(await digest(session), now + maxAge),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie":
          sessionName +
          "=" +
          session +
          "; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=" +
          maxAge,
      });
    }
    const token = request.headers
      .get("Cookie")
      ?.match(/(?:^|;\s*)__Host-kurs=([a-f0-9-]{72})(?:;|$)/)?.[1];
    if (!token) return json({ error: "signin" }, 401);
    const hash = await digest(token);
    if (
      !(await env.GOALS_DB.prepare(
        "SELECT 1 FROM sessions WHERE digest=? AND expires>?",
      )
        .bind(hash, now)
        .first())
    )
      return json({ error: "signin" }, 401);
    if (path === "logout" && request.method === "POST") {
      await env.GOALS_DB.prepare("DELETE FROM sessions WHERE digest=?")
        .bind(hash)
        .run();
      return json({ ok: true }, 200, {
        "Set-Cookie":
          sessionName +
          "=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      });
    }
    if (path === "planner" && request.method === "GET") {
      const state = await journal(env.GOALS_DB);
      return json({ ...state, planner: normalizePlanner(state.planner) });
    }
    if (path === "planner" && request.method === "PUT") {
      const data = await body(request, 2_000_000);
      if (
        !validPlanner(data.planner) ||
        !Number.isSafeInteger(data.revision) ||
        data.revision < 0
      )
        return json({ error: "invalid_plan" }, 400);
      const content = JSON.stringify(data.planner);
      const q =
        data.revision === 0
          ? env.GOALS_DB.prepare(
              "INSERT OR IGNORE INTO journal(id,revision,content) VALUES(1,1,?)",
            ).bind(content)
          : env.GOALS_DB.prepare(
              "UPDATE journal SET revision=revision+1,content=? WHERE id=1 AND revision=?",
            ).bind(content, data.revision);
      const update = await q.run();
      return update.meta.changes === 1
        ? json({ revision: data.revision + 1 })
        : json({ error: "conflict" }, 409);
    }
    const handled = await serviceRoute(request, env, path);
    if (handled) return handled;
    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json(
      {
        error:
          e instanceof RangeError
            ? "too_large"
            : e instanceof SyntaxError
              ? "invalid"
              : "service_unavailable",
      },
      e instanceof RangeError ? 413 : e instanceof SyntaxError ? 400 : 503,
    );
  }
}
