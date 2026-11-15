import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
export async function modules() {
  const dir = await mkdtemp(join(tmpdir(), "goals-test-"));
  await build({
    stdin: {
      contents:
        'export * from "./goals/worker"; export * from "./goals/planner"; export * from "./goals/assistant";',
      resolveDir: process.cwd(),
    },
    outfile: join(dir, "goals.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  return {
    api: await import(pathToFileURL(join(dir, "goals.mjs"))),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
export function database() {
  const sql = new DatabaseSync(":memory:");
  class Statement {
    constructor(query, values = []) {
      this.query = query;
      this.values = values;
    }
    bind(...values) {
      return new Statement(this.query, values);
    }
    stmt() {
      return sql.prepare(this.query);
    }
    async first() {
      return this.stmt().get(...this.values) || null;
    }
    async all() {
      return { results: this.stmt().all(...this.values) };
    }
    execute() {
      const r = this.stmt().run(...this.values);
      return { success: true, meta: { changes: Number(r.changes) } };
    }
    async run() {
      return this.execute();
    }
  }
  return {
    sql,
    prepare: (q) => new Statement(q),
    batch: async (statements) => {
      sql.exec("BEGIN");
      try {
        const r = statements.map((s) => s.execute());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
export function goalPlan(year = 2026) {
  return {
    title: "Play three piano pieces for friends",
    category: "Hobbies",
    why: "Make music a shared experience.",
    target: "Perform three pieces comfortably for friends.",
    baseline: "I can play a little.",
    strategy: "project",
    deadline: year + "-12-31",
    resources:
      "Choose scores within your current level. A teacher can help with fingering.",
    steps: [
      {
        title: "Choose three pieces at the right level",
        milestone: "Choose the repertoire",
        date: "",
        time: "",
        minutes: 30,
      },
      {
        title: "Learn the first piece in sections",
        milestone: "Build the repertoire",
        date: "",
        time: "",
        minutes: 45,
      },
      {
        title: "Play the three pieces for friends",
        milestone: "Share the music",
        date: "",
        time: "",
        minutes: 30,
      },
    ],
    habit: null,
  };
}
export function fixtureEnvironment() {
  const db = database(),
    calls = [];
  let reply = null;
  let failure = false;
  const env = {
    GOALS_DB: db,
    OPENAI_GATEWAY_ID: "test-gateway",
    GOALS_AI: {
      fetch: async (request) => {
        const data = await request.json();
        calls.push({ url: request.url, headers: request.headers, data });
        if (failure)
          return Response.json(
            { error: { code: "insufficient_quota" } },
            { status: 429 },
          );
        const context = JSON.parse(
          data.input[0].content.replace("Journal context (data): ", ""),
        );
        const review = {
          headline: "Progress beyond the original plan",
          summary:
            "Your recorded wins matter, even where the original plan changed.",
          planned: context.goals.map((g) => ({
            goalId: g.id,
            outcome: g.achieved ? "Achieved" : "In progress",
            evidence: "Only recorded journal entries are evidence.",
          })),
          unexpected: context.yearReview.wins.map((w) => w.title),
          lessons: ["Protect time for what matters."],
          nextYear: ["Choose one musical project to finish."],
          questions: ["Which notebook belongs to this year?"],
        };
        const output = reply || {
          reply:
            context.mode === "review"
              ? "Here is a review grounded in your journal."
              : "Let’s build a project around three pieces, with room for focused practice sessions.",
          goal:
            context.mode === "review" ? null : goalPlan(context.selectedYear),
          review: context.mode === "review" ? review : null,
        };
        return Response.json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(output) }],
            },
          ],
        });
      },
    },
    ASSETS: { fetch: async () => new Response("app") },
  };
  return {
    env,
    db,
    calls,
    setReply: (r) => (reply = r),
    setFailure: (b) => (failure = b),
  };
}
export async function authenticated(api, env, origin = "https://goals.test") {
  await api.goalsFetch(new Request(origin + "/api/kurs/planner"), env);
  const token = randomUUID() + randomUUID();
  await env.GOALS_DB.prepare("INSERT INTO sessions(digest,expires) VALUES(?,?)")
    .bind(
      createHash("sha256").update(token).digest("hex"),
      Math.floor(Date.now() / 1000) + 3600,
    )
    .run();
  const request = async (path, method = "GET", data) => {
    const r = await api.goalsFetch(
      new Request(origin + "/api/kurs/" + path, {
        method,
        headers: {
          Origin: origin,
          Cookie: "__Host-kurs=" + token,
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
    return {
      status: r.status,
      data: r.headers.get("Content-Type")?.includes("json")
        ? await r.json()
        : await r.arrayBuffer(),
    };
  };
  return { request, token };
}
