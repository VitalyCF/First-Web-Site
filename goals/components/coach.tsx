import { useRef, useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";
import { type Goal, type Habit } from "../planner";
import type { Draft } from "./goal-editor";
export type Proposal = Draft & Omit<Habit, "since">;
type Turn = {
  role: "user" | "assistant";
  content: string;
  suggestion?: Proposal;
};
export function Coach({
  goal,
  initial,
  onApply,
}: {
  goal?: Goal;
  initial: string;
  onApply: (s: Proposal) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]),
    [text, setText] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  async function ask(prompt: string) {
    if (!prompt.trim() || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const next: Turn[] = [...turns, { role: "user", content: prompt.trim() }];
    try {
      const r = await fetch("/api/kurs/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId: goal?.id,
          turns: next
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!r.ok)
        throw Error(
          r.status === 401
            ? "Сессия закончилась. Войди снова."
            : "Workers AI пока не ответил. Попробуй ещё раз.",
        );
      const answer = (await r.json()) as {
        reply: string;
        suggestion?: Proposal;
      };
      setTurns([
        ...next,
        {
          role: "assistant",
          content: answer.reply,
          suggestion: answer.suggestion,
        },
      ]);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="form coach-convo">
      <small>OpenAI gpt-oss-120b · Cloudflare Workers AI</small>
      {goal && <div className="context-goal">{goal.title}</div>}
      {!turns.length && (
        <div className="quick-prompts">
          {[
            "С чего начать за две минуты?",
            "Подбери ритм на неделю",
            "Как вернуться после пропуска?",
          ].map((p) => (
            <button key={p} disabled={busy} onClick={() => ask(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      {turns.map((t, i) => (
        <div className={"bubble " + t.role} key={i}>
          <b>{t.role === "user" ? "Ты" : "Катя"}</b>
          <p>{t.content}</p>
          {t.suggestion && (
            <div className="proposal">
              <p>
                {t.suggestion.cue} · {t.suggestion.action}
              </p>
              <small>Минимум: {t.suggestion.minimum}</small>
              <button
                className="underlink"
                onClick={() => onApply(t.suggestion!)}
              >
                <Sparkles size={15} />
                {goal ? "Проверить и принять ритм" : "Проверить новую цель"}
              </button>
            </div>
          )}
        </div>
      ))}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <label>
          Твоя мысль
          <textarea
            rows={3}
            maxLength={2400}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что хочется изменить?"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="action-ink" disabled={busy || !text.trim()}>
          {busy ? "Катя думает…" : "Спросить Катю"}
          <ArrowUp size={15} />
        </button>
      </form>
    </div>
  );
}
