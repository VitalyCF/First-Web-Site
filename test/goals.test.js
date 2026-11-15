import test from "node:test";
import assert from "node:assert/strict";
import {
  modules,
  fixtureEnvironment,
  authenticated,
  goalPlan,
} from "./helpers/goals-env.js";

test("private goal conversations, acceptance and year reviews preserve the journal", async () => {
  const { api, cleanup } = await modules();
  const { env, db, calls, setFailure, setReply } = fixtureEnvironment();
  try {
    assert.equal(
      (
        await api.goalsFetch(
          new Request("https://goals.test/api/kurs/sources"),
          env,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await api.goalsFetch(
          new Request("https://goals.test/api/kurs/chat", {
            method: "POST",
            headers: { Origin: "https://other.test" },
          }),
          env,
        )
      ).status,
      403,
    );
    const { request } = await authenticated(api, env);
    const existing = api.goalFrom(goalPlan(), 2026, "original");
    existing.category = "Хобби";
    existing.steps[0].done = true;
    existing.entries = [{ date: "2026-11-01", value: "First piece learned" }];
    existing.practice = [
      { date: "2026-11-01", action: "Play slowly", kind: "full" },
    ];
    let state = { planner: { goals: [existing] }, revision: 0 };
    assert.equal((await request("planner", "PUT", state)).status, 200);
    state = (await request("planner")).data;
    assert.equal(state.planner.goals[0].category, "Hobbies");
    const chat = {
      id: "piano",
      year: 2026,
      goalId: "original",
      mode: "goal",
      tier: "balanced",
      text: "Help me choose a practical approach.",
    };
    let result = await request("chat", "POST", chat);
    assert.equal(result.status, 200);
    let turn = result.data.conversation.turns.at(-1);
    assert.equal(turn.model, "gpt-6.1-sol");
    assert.equal(
      calls[0].url,
      "https://workers-binding.ai/ai-gateway/gateways/test-gateway/openai/responses",
    );
    assert.equal(calls[0].headers.get("cf-aig-no-wholesale"), "true");
    assert.equal(calls[0].headers.get("cf-aig-collect-log-payload"), "false");
    assert.equal(calls[0].data.store, false);
    assert.equal(
      (await request("planner")).data.revision,
      1,
      "draft does not mutate the journal",
    );
    result = await request("accept", "POST", {
      conversationId: "piano",
      turnId: turn.id,
      revision: 1,
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.revision, 2);
    const updated = result.data.planner.goals[0];
    assert.equal(updated.steps.length, 3);
    assert.equal(updated.steps[0].done, true);
    assert.deepEqual(updated.entries, existing.entries);
    assert.deepEqual(updated.practice, existing.practice);
    result = await request("accept", "POST", {
      conversationId: "piano",
      turnId: turn.id,
      revision: 1,
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.alreadyApplied, true);
    assert.equal(result.data.revision, 2);
    result = await request("chat", "POST", {
      ...chat,
      text: "Make the next step simpler.",
      tier: "quick",
    });
    assert.equal(result.status, 200);
    assert.equal(calls.at(-1).data.model, "gpt-6-luna");
    assert(
      calls.at(-1).data.input.some((t) => t.content.includes("Draft: ")),
      "draft is available for refinement",
    );
    assert.equal(
      (await request("conversations/piano")).data.conversation.turns.length,
      4,
    );
    setFailure(true);
    assert.equal(
      (await request("chat", "POST", { ...chat, text: "Try again" })).data
        .error,
      "quota",
    );
    setFailure(false);
    assert.equal(
      (await request("conversations/piano")).data.conversation.turns.length,
      4,
      "failure preserves history",
    );
    const note = {
      id: "test-note",
      year: null,
      title: "Notebook",
      text: "Year not visible. A plus sign is not confirmed completion.",
      image: Buffer.from([255, 216, 255, 0]).toString("base64"),
    };
    assert.equal((await request("sources", "POST", note)).status, 201);
    assert.equal((await request("sources", "POST", note)).status, 409);
    result = await request("sources");
    assert.equal(result.data.sources[0].year, null);
    assert.equal(result.data.sources[0].hasImage, 1);
    assert.equal((await request("sources/test-note/image")).status, 200);
    assert.equal(
      (
        await request("sources/test-note", "PUT", {
          year: 2025,
          text: note.text,
          revision: 1,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("sources/test-note", "PUT", {
          year: 2026,
          text: note.text,
          revision: 1,
        })
      ).status,
      409,
    );
    state = (await request("planner")).data;
    state.planner = api.withReview(state.planner, {
      year: 2026,
      notes: "I changed my priorities.",
      wins: [
        { id: "win", title: "Built a personal website", area: "Personal" },
      ],
      ratings: [{ area: "Hobbies", score: 7 }],
    });
    assert.equal((await request("planner", "PUT", state)).status, 200);
    result = await request("chat", "POST", {
      id: "reflection",
      year: 2026,
      goalId: "",
      mode: "review",
      tier: "balanced",
      text: "Review my year.",
    });
    assert.equal(result.status, 200);
    turn = result.data.conversation.turns.at(-1);
    assert.deepEqual(turn.proposal.review.unexpected, [
      "Built a personal website",
    ]);
    assert.equal(calls.at(-1).data.reasoning.effort, "medium");
    state = (await request("planner")).data;
    result = await request("accept", "POST", {
      conversationId: "reflection",
      turnId: turn.id,
      revision: state.revision,
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.planner.reviews[0].ratings[0].score, 7);
    assert.equal(
      result.data.planner.reviews[0].notes,
      "I changed my priorities.",
    );
    result = await request("chat", "POST", {
      id: "new",
      year: 2027,
      goalId: "",
      mode: "goal",
      tier: "balanced",
      text: "Create a goal.",
    });
    turn = result.data.conversation.turns.at(-1);
    state = (await request("planner")).data;
    assert.equal(
      (
        await request("accept", "POST", {
          conversationId: "new",
          turnId: turn.id,
          revision: state.revision - 1,
        })
      ).status,
      409,
    );
    result = await request("accept", "POST", {
      conversationId: "new",
      turnId: turn.id,
      revision: state.revision,
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.planner.goals.length, 2);
    assert.equal(result.data.conversation.goalId, "ai-" + turn.id);
    const carry = api.carryGoal(
      {
        ...existing,
        steps: [{ ...existing.steps[1], date: "2026-12-01", time: "12:00" }],
      },
      2027,
    );
    assert.equal(carry.steps[0].date, "");
    assert.equal(carry.deadline, "");
    assert.equal(carry.practice.length, 0);
    const invalid = api.goalFrom(goalPlan(), 2026, "invalid");
    invalid.steps[0].date = "2026-02-30";
    assert.equal(api.validPlanner({ goals: [invalid] }), false);
    const withRoutine = api.putHabit(existing, {
      since: "2026-01-01",
      cue: "After coffee",
      action: "Play piano",
      minimum: "Play a scale",
      minutes: 20,
      days: [1, 3, 5],
    });
    const stopped = api.stopHabit(withRoutine, "2026-11-01");
    assert(api.habitAt(stopped, "2026-10-31"));
    assert.equal(api.habitAt(stopped, "2026-11-01"), undefined);
    assert.deepEqual(stopped.practice, existing.practice);
    assert.equal(api.validPlanner({ goals: [stopped] }), true);
    assert.equal(api.carryGoal(stopped, 2027).habits.length, 0);
    const stale = await request("chat", "POST", {
      id: "stale-review",
      year: 2026,
      mode: "review",
      tier: "balanced",
      text: "Review again.",
    });
    state = (await request("planner")).data;
    await request("planner", "PUT", state);
    assert.equal(
      (
        await request("accept", "POST", {
          conversationId: "stale-review",
          turnId: stale.data.conversation.turns.at(-1).id,
          revision: state.revision + 1,
        })
      ).data.error,
      "stale_review",
    );
    setReply({
      reply: "Review",
      goal: null,
      review: {
        headline: "Review",
        summary: "Evidence missing",
        planned: [
          { goalId: "fabricated", outcome: "Done", evidence: "Unknown" },
        ],
        unexpected: [],
        lessons: [],
        nextYear: [],
        questions: [],
      },
    });
    assert.equal(
      (
        await request("chat", "POST", {
          id: "invalid-review",
          year: 2026,
          mode: "review",
          tier: "balanced",
          text: "Review.",
        })
      ).data.error,
      "invalid_review",
    );
  } finally {
    db.sql.close();
    await cleanup();
  }
});
