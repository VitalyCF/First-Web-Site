import {shapeChat} from './shape';
import { body, json, journal } from "./storage";
import { normalizePlanner, validPlanner, type SourceNote } from "./planner";
import {
  applyProposal,
  generate,
  AIError,
  models,
  type AssistantEnv,
  type Conversation,
  type Turn,
} from "./assistant";

export const extraTables = [
  "CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY,content TEXT NOT NULL,updated TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS conversation_locks (id TEXT PRIMARY KEY,expires INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS accepted_proposals (id TEXT PRIMARY KEY,applied_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS source_notes (id TEXT PRIMARY KEY,title TEXT NOT NULL,year INTEGER,text TEXT NOT NULL,image BLOB,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL)",
];
const idOK = (s: unknown): s is string =>
  typeof s === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(s);
async function conversation(env: AssistantEnv, id: string) {
  const r = await env.GOALS_DB.prepare(
    "SELECT content FROM conversations WHERE id=?",
  )
    .bind(id)
    .first<{ content: string }>();
  return r ? (JSON.parse(r.content) as Conversation) : null;
}
async function sources(env: AssistantEnv) {
  const r = await env.GOALS_DB.prepare(
    "SELECT id,title,year,text,revision,created_at AS createdAt,(image IS NOT NULL) AS hasImage FROM source_notes ORDER BY created_at",
  ).all<SourceNote>();
  return r.results;
}
async function lock(env: AssistantEnv, id: string) {
  const now = Date.now();
  await env.GOALS_DB.prepare(
    "DELETE FROM conversation_locks WHERE id=? AND expires<?",
  )
    .bind(id, now)
    .run();
  return (
    (
      await env.GOALS_DB.prepare(
        "INSERT OR IGNORE INTO conversation_locks(id,expires) VALUES(?,?)",
      )
        .bind(id, now + 120000)
        .run()
    ).meta.changes === 1
  );
}
const unlock = (env: AssistantEnv, id: string) =>
  env.GOALS_DB.prepare("DELETE FROM conversation_locks WHERE id=?")
    .bind(id)
    .run();
export async function serviceRoute(
  request: Request,
  env: AssistantEnv,
  path: string,
): Promise<Response | undefined> {
  if(path==='shape-chat'&&request.method==='POST')return shapeChat(request,env);
  if (path === "ai-status" && request.method === "GET")
    return json({ provider: "OpenAI", gateway: env.OPENAI_GATEWAY_ID, models });
  if (path === "sources" && request.method === "GET")
    return json({ sources: await sources(env) });
  if (path === "sources" && request.method === "POST") {
    const d = await body(request, 2_200_000);
    if (
      !idOK(d.id) ||
      typeof d.title !== "string" ||
      d.title.length > 200 ||
      typeof d.text !== "string" ||
      d.text.length > 30000 ||
      (d.year !== null &&
        (!Number.isInteger(d.year) || d.year < 2000 || d.year > 2200))
    )
      return json({ error: "invalid_source" }, 400);
    let image: Uint8Array | null = null;
    if (d.image) {
      if (
        typeof d.image !== "string" ||
        d.image.length > 2000000 ||
        !/^[/+A-Za-z0-9=]+$/.test(d.image)
      )
        return json({ error: "invalid_image" }, 400);
      image = Uint8Array.from(atob(d.image), (c) => c.charCodeAt(0));
      if (image[0] !== 255 || image[1] !== 216 || image[2] !== 255)
        return json({ error: "jpeg_required" }, 400);
    }
    const result = await env.GOALS_DB.prepare(
      "INSERT OR IGNORE INTO source_notes(id,title,year,text,image,created_at) VALUES(?,?,?,?,?,?)",
    )
      .bind(d.id, d.title, d.year, d.text, image, new Date().toISOString())
      .run();
    return result.meta.changes
      ? json({ sources: await sources(env) }, 201)
      : json({ error: "source_exists" }, 409);
  }
  const sourcePath = path.match(/^sources\/([a-zA-Z0-9_-]{1,100})(\/image)?$/);
  if (sourcePath && request.method === "GET" && sourcePath[2]) {
    const r = await env.GOALS_DB.prepare(
      "SELECT image FROM source_notes WHERE id=?",
    )
      .bind(sourcePath[1])
      .first<{ image: ArrayBuffer | null }>();
    return r?.image
      ? new Response(new Uint8Array(r.image), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        })
      : json({ error: "not_found" }, 404);
  }
  if (sourcePath && request.method === "PUT" && !sourcePath[2]) {
    const d = await body(request, 100000);
    if (
      !Number.isInteger(d.revision) ||
      typeof d.text !== "string" ||
      d.text.length > 30000 ||
      (d.year !== null &&
        (!Number.isInteger(d.year) || d.year < 2000 || d.year > 2200))
    )
      return json({ error: "invalid_source" }, 400);
    const r = await env.GOALS_DB.prepare(
      "UPDATE source_notes SET year=?,text=?,revision=revision+1 WHERE id=? AND revision=?",
    )
      .bind(d.year, d.text, sourcePath[1], d.revision)
      .run();
    return r.meta.changes
      ? json({ sources: await sources(env) })
      : json({ error: "conflict" }, 409);
  }
  if (path === "conversations" && request.method === "GET") {
    const rows = await env.GOALS_DB.prepare(
      "SELECT content,updated FROM conversations ORDER BY updated DESC LIMIT 100",
    ).all<{ content: string; updated: string }>();
    return json({
      conversations: rows.results.map((r) => {
        const c = JSON.parse(r.content) as Conversation;
        return {
          id: c.id,
          title: c.title,
          year: c.year,
          goalId: c.goalId,
          mode: c.mode,
          updated: r.updated,
        };
      }),
    });
  }
  if (path.startsWith("conversations/") && request.method === "GET") {
    const id = path.slice("conversations/".length);
    if (!idOK(id)) return json({ error: "invalid" }, 400);
    const conv = await conversation(env, id);
    if (!conv) return json({ error: "not_found" }, 404);
    const accepted = await env.GOALS_DB.prepare(
      "SELECT id FROM accepted_proposals",
    ).all<{ id: string }>();
    return json({
      conversation: conv,
      accepted: accepted.results.map((r) => r.id),
    });
  }
  if (path === "chat" && request.method === "POST") {
    const d = await body(request, 20000);
    if (
      !idOK(d.id) ||
      typeof d.text !== "string" ||
      !d.text.trim() ||
      d.text.length > 8000 ||
      !Number.isInteger(d.year) ||
      d.year < 2000 ||
      d.year > 2200 ||
      !["goal", "review"].includes(d.mode) ||
      !["balanced", "quick"].includes(d.tier) ||
      (d.goalId && !idOK(d.goalId))
    )
      return json({ error: "invalid" }, 400);
    if (!(await lock(env, d.id))) return json({ error: "chat_busy" }, 409);
    try {
      const saved = await conversation(env, d.id);
      if (
        saved &&
        (saved.year !== d.year ||
          saved.mode !== d.mode ||
          saved.goalId !== (d.goalId || ""))
      )
        return json({ error: "context_changed" }, 409);
      const conv: Conversation = saved || {
        id: d.id,
        year: d.year,
        goalId: d.goalId || "",
        mode: d.mode,
        title: d.text.trim().slice(0, 90),
        turns: [],
      };
      if (conv.turns.length >= 100)
        return json({ error: "conversation_full" }, 400);
      const state = await journal(env.GOALS_DB),
        p = normalizePlanner(state.planner);
      if (
        conv.goalId &&
        !p.goals.some((g) => g.id === conv.goalId && g.year === conv.year)
      )
        return json({ error: "goal_removed" }, 409);
      const reply = await generate(
        env,
        conv,
        p,
        await sources(env),
        d.text.trim(),
        d.tier,
      );
      reply.basisRevision = state.revision;
      conv.turns.push(
        {
          id: crypto.randomUUID(),
          role: "user",
          content: d.text.trim(),
          at: new Date().toISOString(),
        },
        reply,
      );
      await env.GOALS_DB.prepare(
        "INSERT INTO conversations(id,content,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated=excluded.updated",
      )
        .bind(conv.id, JSON.stringify(conv), reply.at)
        .run();
      return json({ conversation: conv });
    } catch (e) {
      return json(
        { error: e instanceof AIError ? e.code : "ai_unavailable" },
        502,
      );
    } finally {
      await unlock(env, d.id);
    }
  }
  if (path === "accept" && request.method === "POST") {
    const d = await body(request, 1000);
    if (
      !idOK(d.conversationId) ||
      !idOK(d.turnId) ||
      !Number.isSafeInteger(d.revision) ||
      d.revision < 0
    )
      return json({ error: "invalid" }, 400);
    const state = await journal(env.GOALS_DB);
    if (
      await env.GOALS_DB.prepare("SELECT id FROM accepted_proposals WHERE id=?")
        .bind(d.turnId)
        .first()
    )
      return json({ ...state, alreadyApplied: true });
    if (state.revision !== d.revision) return json({ error: "conflict" }, 409);
    const conv = await conversation(env, d.conversationId),
      turn = conv?.turns.find(
        (t) => t.id === d.turnId && t.role === "assistant",
      );
    if (!conv || !turn) return json({ error: "not_found" }, 404);
    if (turn.proposal?.review && turn.basisRevision !== state.revision)
      return json({ error: "stale_review" }, 409);
    let planner;
    try {
      planner = applyProposal(normalizePlanner(state.planner), conv, turn);
    } catch (e) {
      return json({ error: e instanceof AIError ? e.code : "invalid" }, 400);
    }
    if (!validPlanner(planner)) return json({ error: "invalid_plan" }, 400);
    const save =
      state.revision === 0
        ? env.GOALS_DB.prepare(
            "INSERT OR IGNORE INTO journal(id,revision,content) VALUES(1,1,?)",
          ).bind(JSON.stringify(planner))
        : env.GOALS_DB.prepare(
            "UPDATE journal SET content=?,revision=revision+1 WHERE id=1 AND revision=?",
          ).bind(JSON.stringify(planner), state.revision);
    if (turn.proposal?.goal && !conv.goalId) conv.goalId = "ai-" + turn.id;
    const result = await env.GOALS_DB.batch([
      save,
      env.GOALS_DB.prepare(
        "INSERT INTO accepted_proposals(id,applied_at) SELECT ?,? WHERE changes()=1",
      ).bind(d.turnId, new Date().toISOString()),
      env.GOALS_DB.prepare(
        "UPDATE conversations SET content=? WHERE id=? AND changes()=1",
      ).bind(JSON.stringify(conv), conv.id),
    ]);
    return result[0].meta.changes
      ? json({ planner, revision: state.revision + 1, conversation: conv })
      : json({ error: "conflict" }, 409);
  }
}
