import { loginMessage } from "./proof";
import { ownerPublicKey } from "./owner";
import { day, habitAt, planned, validPlanner, type Planner } from "./planner";

const model = "@cf/openai/gpt-oss-120b";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) => Response.json(data, { status, headers: { ...headers, ...extra } });
const enc = new TextEncoder();
const sessionName = "__Host-kurs";
const maxAge = 60 * 60 * 24 * 90;
const empty: Planner = { goals: [] };
type Env = {
  GOALS_DB: D1Database;
  GOALS_AI: {
    run: (name: string, options: Record<string, unknown>) => Promise<any>;
  };
  ASSETS: { fetch: (r: Request) => Promise<Response> };
};
let initialized: Promise<void> | undefined;

function schema(db: D1Database) {
  if (!initialized)
    initialized = db
      .batch([
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
async function body(request: Request, max: number) {
  if (Number(request.headers.get("Content-Length")) > max)
    throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  const parsed = JSON.parse(new TextDecoder().decode(buf));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new SyntaxError();
  return parsed;
}
async function journal(db: D1Database) {
  const row = await db
    .prepare("SELECT revision,content FROM journal WHERE id=1")
    .first<{ revision: number; content: string }>();
  return row
    ? { revision: row.revision, planner: JSON.parse(row.content) as Planner }
    : { revision: 0, planner: empty };
}
function textOf(data: any): string {
  if (typeof data === "string") return data;
  for (const candidate of [
    data?.response,
    data?.choices?.[0]?.message?.content,
    data?.output_text,
  ])
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  return (data?.output ?? [])
    .filter((x: any) => x?.type === "message")
    .flatMap((x: any) => x.content ?? [])
    .filter((x: any) => x.type === "output_text")
    .map((x: any) => x.text)
    .join("\n");
}
const coachRules = [
  "Ты Катя, помощник по личным целям. Обращайся на ты, отвечай на русском по делу.",
  "Помогай маленькими регулярными действиями. Привяжи действие к знакомому моменту дня, предложи обычную версию и минимум до двух минут для трудного дня. Учитывай выбранные дни, сделанное и последние пропуски. Пропуск не обнуляет прогресс.",
  "Если цель неясна, задай один вопрос. Спрашивающему про конкретный следующий шаг дай применимый совет. Не выдумывай историю и не считай выполненную привычку достижением всей цели.",
  "Верни JSON без разметки с полем reply (1–3 коротких предложения) и необязательным suggestion. Для конкретного плана suggestion содержит title, target, steps (1–4 последовательных шага), cue, action, minimum, minutes (1–30), days (массив ISO дней JS: 0 воскресенье, 1 понедельник, ..., 6 суббота). Не упоминай JSON в reply.",
].join(" ");
async function coach(env: Env, data: any) {
  if (
    !Array.isArray(data.turns) ||
    !data.turns.length ||
    data.turns.length > 12 ||
    data.turns.some(
      (t: any) =>
        !t ||
        !["user", "assistant"].includes(t.role) ||
        typeof t.content !== "string" ||
        t.content.length > 3000,
    ) ||
    data.turns.at(-1).role !== "user"
  )
    return json({ error: "invalid" }, 400);
  const { planner } = await journal(env.GOALS_DB);
  const goal = planner.goals.find((g) => g.id === data.goalId);
  const now = day();
  const missed = goal
    ? Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() - i - 1);
        return d.toISOString().slice(0, 10);
      }).filter(
        (d) =>
          d.startsWith(goal.year + "-") &&
          planned(goal, d) &&
          !goal.practice?.some((p) => p.date === d),
      )
    : [];
  const context = goal
    ? {
        title: goal.title,
        target: goal.target,
        steps: goal.steps.slice(0, 12),
        habit: habitAt(goal, now),
        recentPractice: (goal.practice ?? []).slice(-21),
        scheduledWithoutCheckIn: missed,
        lastResult: goal.entries.at(-1)?.value || goal.baseline,
      }
    : { newGoal: true };
  const messages = [
    { role: "system", content: coachRules },
    {
      role: "user",
      content: "Контекст журнала на " + now + ": " + JSON.stringify(context),
    },
    ...data.turns,
  ];
  try {
    let result;
    try {
      result = await env.GOALS_AI.run(model, {
        messages,
        reasoning_effort: "low",
        max_tokens: 1500,
      });
    } catch (error) {
      if (
        !/schema|input.*required|must have required property|invalid.*input/i.test(
          String(error),
        )
      )
        throw error;
      result = await env.GOALS_AI.run(model, {
        instructions: coachRules,
        input: JSON.stringify(messages.slice(1)),
        reasoning: { effort: "low" },
        max_output_tokens: 1500,
      });
    }
    const raw = textOf(result).trim();
    if (!raw) return json({ error: "empty_response" }, 502);
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
    } catch {}
    if (typeof parsed?.reply !== "string")
      return json({ reply: raw.slice(0, 2800), model });
    const s = parsed.suggestion;
    const good =
      s &&
      ["title", "target", "cue", "action", "minimum"].every(
        (k) => typeof s[k] === "string" && s[k].trim() && s[k].length <= 300,
      ) &&
      Array.isArray(s.steps) &&
      s.steps.length <= 6 &&
      s.steps.every(
        (t: any) => typeof t === "string" && t.trim() && t.length <= 300,
      ) &&
      Number.isInteger(s.minutes) &&
      s.minutes >= 1 &&
      s.minutes <= 180 &&
      Array.isArray(s.days) &&
      s.days.length > 0 &&
      s.days.length <= 7 &&
      s.days.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 6);
    return json({
      reply: parsed.reply.slice(0, 2800),
      suggestion: good ? s : undefined,
      model,
    });
  } catch {
    return json({ error: "inference_unavailable" }, 502);
  }
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
        model,
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
    if (path === "planner" && request.method === "GET")
      return json(await journal(env.GOALS_DB));
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
    if (path === "coach" && request.method === "POST")
      return await coach(env, await body(request, 42000));
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
