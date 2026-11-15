import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Clock,
  MessageCircle,
  Plus,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import { strategyName, type Planner } from "../planner";
import { type Conversation, type Turn, type GoalPlan } from "../assistant";
import { ReportView } from "./review";
export type ChatContext = {
  id: string;
  year: number;
  goalId: string;
  mode: "goal" | "review";
  prompt?: string;
};
export function PlanPreview({ plan }: { plan: GoalPlan }) {
  const groups = [
    ...new Set(plan.steps.map((s) => s.milestone || "Next steps")),
  ];
  return (
    <div className="plan-preview">
      <span className="section-kicker">
        {plan.category} · {strategyName(plan.strategy)}
      </span>
      <h3>{plan.title}</h3>
      <p className="plan-outcome">{plan.target}</p>
      {plan.why && <p>{plan.why}</p>}
      {plan.deadline && <small>Target date · {plan.deadline}</small>}
      {groups.map((m) => (
        <section key={m}>
          <h4>{m}</h4>
          {plan.steps
            .filter((s) => (s.milestone || "Next steps") === m)
            .map((s, i) => (
              <p className="preview-step" key={i}>
                <span className="step-dot" />
                <span>
                  {s.title}
                  {(s.date || s.minutes > 0) && (
                    <small>
                      {[s.date, s.time, s.minutes ? s.minutes + " min" : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                </span>
              </p>
            ))}
        </section>
      ))}
      {plan.resources && (
        <section>
          <h4>Resources & support</h4>
          <p>{plan.resources}</p>
        </section>
      )}
      {!plan.habit && (
        <p className="muted">
          This plan uses individual steps, with no recurring routine.
        </p>
      )}
      {plan.habit && (
        <section>
          <h4>Optional routine</h4>
          <p>
            {plan.habit.cue} · {plan.habit.action}
          </p>
          <small>
            {plan.habit.minutes} min · Easier version · {plan.habit.minimum}
          </small>
        </section>
      )}
    </div>
  );
}
export function Coach({
  initial,
  planner,
  revision,
  adopt,
  reload,
  onManual,
  onBack,
}: {
  initial: ChatContext;
  planner: Planner;
  revision: number;
  adopt: (data: { planner: Planner; revision: number }) => void;
  reload: () => Promise<void>;
  onManual: () => void;
  onBack: () => void;
}) {
  const [context, setContext] = useState(initial),
    [conv, setConv] = useState<Conversation | null>(null),
    [list, setList] = useState<Omit<Conversation, "turns">[]>([]),
    [text, setText] = useState(initial.prompt || ""),
    [tier, setTier] = useState<"balanced" | "quick">("balanced"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState<string[]>([]),
    [opening, setOpening] = useState(false);
  const guard = useRef(false),
    input = useRef<HTMLTextAreaElement>(null),
    bottom = useRef<HTMLDivElement>(null);
  const refresh = () =>
    api("conversations").then((d) => setList(d.conversations));
  useEffect(() => {
    void refresh().catch(() =>
      setError("Could not load conversation history."),
    );
  }, []);
  async function open(id: string) {
    if (guard.current) return;
    setOpening(true);
    setError("");
    try {
      const d = await api("conversations/" + id);
      setConv(d.conversation);
      setContext({ ...d.conversation, prompt: "" });
      setAccepted(d.accepted);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }
  async function send(value = text) {
    if (!value.trim() || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const d = await api("chat", {
        method: "POST",
        body: JSON.stringify({
          id: context.id,
          year: context.year,
          goalId: context.goalId,
          mode: context.mode,
          text: value.trim(),
          tier,
        }),
      });
      setConv(d.conversation);
      setText("");
      void refresh().catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function accept(turn: Turn) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const d = await api("accept", {
        method: "POST",
        body: JSON.stringify({
          conversationId: context.id,
          turnId: turn.id,
          revision,
        }),
      });
      adopt(d);
      setAccepted((a) => [...a, turn.id]);
      if (d.conversation) {
        setConv(d.conversation);
        setContext({ ...d.conversation, prompt: "" });
      }
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    bottom.current?.parentElement?.scrollTo({
      top: bottom.current.parentElement.scrollHeight,
      behavior: "smooth",
    });
  }, [conv?.turns.length, busy]);
  const goal = planner.goals.find((g) => g.id === context.goalId);
  const prompts =
    context.mode === "review"
      ? [
          "Help me reflect on this year.",
          "What did I achieve that I never planned?",
          "Help me choose better goals next year.",
        ]
      : goal
        ? [
            "Help me rethink this plan.",
            "What should I do next, and when?",
            "What might be blocking me?",
          ]
        : [
            "I have an idea, help me shape it.",
            "Help me choose what deserves my time.",
            "Turn one of my notebook ideas into a plan.",
          ];
  return (
    <section>
      <header className="spread-title chat-title">
        <div>
          <span className="section-kicker">Your thinking partner</span>
          <h1>
            With Katya<span>.</span>
          </h1>
        </div>
        <button className="underlink" onClick={onBack}>
          Back to {context.mode === "review" ? "review" : "journal"}
          <ArrowUpRight size={15} />
        </button>
      </header>
      <div className="chat-layout">
        <aside className="chat-history">
          <button
            className="underlink"
            disabled={busy}
            onClick={() => {
              setConv(null);
              setContext({ ...initial, id: crypto.randomUUID() });
              setText("");
              setAccepted([]);
              setError("");
            }}
          >
            <Plus size={16} />
            New conversation
          </button>
          <p className="section-kicker history-label">Conversations</p>
          {list.map((c) => (
            <button
              key={c.id}
              className={
                "history-chat " + (context.id === c.id ? "selected" : "")
              }
              disabled={busy}
              onClick={() => void open(c.id)}
            >
              <MessageCircle size={14} />
              <span>
                {c.title}
                <small>
                  {c.year} ·{" "}
                  {c.mode === "review" ? "Year review" : "Goal planning"}
                </small>
              </span>
            </button>
          ))}
          <button className="underlink manual-link" onClick={onManual}>
            Write a goal manually
          </button>
        </aside>
        <div className="conversation">
          <div className="conversation-context">
            <span>
              {goal?.title ||
                (context.mode === "review"
                  ? "Reflecting on " + context.year
                  : "A new goal for " + context.year)}
            </span>
            <select
              aria-label="Response mode"
              value={tier}
              disabled={busy}
              onChange={(e) => setTier(e.target.value as "balanced" | "quick")}
            >
              <option value="balanced">Balanced · GPT-6.1 Sol</option>
              <option value="quick">Quick · GPT-6 Luna</option>
            </select>
          </div>
          <div className="chat-messages" aria-live="polite">
            {opening ? (
              <p>Opening conversation…</p>
            ) : !conv?.turns.length ? (
              <div className="chat-welcome">
                <Sparkles size={25} />
                <h2>
                  {context.mode === "review"
                    ? "What did this year really give you?"
                    : goal
                      ? "Let’s find a way forward."
                      : "Tell me what you have in mind."}
                </h2>
                <p>
                  {context.mode === "review"
                    ? "We can look at the goals you set, the things that surprised you, and what you want to take forward."
                    : "A rough thought is enough. We can shape the outcome, choose milestones, and work out where it fits in your life."}
                </p>
                <div className="quick-prompts">
                  {prompts.map((p) => (
                    <button
                      disabled={busy}
                      key={p}
                      onClick={() => void send(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              conv.turns.map((t) => (
                <article key={t.id} className={"chat-turn " + t.role}>
                  <span className="speaker">
                    {t.role === "user" ? "You" : "Katya"}
                  </span>
                  <p>{t.content}</p>
                  {t.proposal?.goal && (
                    <PlanPreview plan={t.proposal.goal} />
                  )}{" "}
                  {t.proposal?.review && (
                    <ReportView
                      report={t.proposal.review}
                      goals={planner.goals}
                    />
                  )}{" "}
                  {(t.proposal?.goal || t.proposal?.review) && (
                    <div className="draft-actions">
                      {accepted.includes(t.id) ? (
                        <span className="saved-label">
                          <Check size={16} />
                          Saved to your journal
                        </span>
                      ) : (
                        <>
                          <button
                            className="action-ink"
                            disabled={busy}
                            onClick={() => void accept(t)}
                          >
                            {t.proposal.review
                              ? "Save year review"
                              : context.goalId
                                ? "Update my plan"
                                : "Create this goal"}
                            <Check size={16} />
                          </button>
                          <button
                            className="underlink"
                            disabled={busy}
                            onClick={() => {
                              setText("I would like to change this draft. ");
                              input.current?.focus();
                            }}
                          >
                            Refine together
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
            {busy && (
              <p className="thinking">
                <span className="sun-dot" />
                Thinking through your plan…
              </p>
            )}
            <div ref={bottom} />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <form
            className="chat-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="chat-message">
              Your message
            </label>
            <textarea
              id="chat-message"
              ref={input}
              maxLength={8000}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                context.mode === "review"
                  ? "What happened this year?"
                  : "I would like to…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              aria-label="Send message"
              className="send-button"
              disabled={busy || opening || !text.trim()}
            >
              <ArrowUp size={20} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
