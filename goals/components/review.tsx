import { useEffect, useState } from "react";
import { ArrowRight, Check, Plus, Sparkles, X } from "lucide-react";
import { api } from "../api";
import {
  categories,
  areaName,
  reviewFor,
  withReview,
  type Goal,
  type Planner,
  type YearReport,
  type SourceNote,
  type YearReview,
} from "../planner";
export function ReportView({
  report,
  goals,
}: {
  report: YearReport;
  goals: Goal[];
}) {
  return (
    <div className="year-report">
      <span className="section-kicker">Year in perspective</span>
      <h3>{report.headline}</h3>
      <p>{report.summary}</p>
      {report.planned.length > 0 && (
        <section>
          <h4>Intention & outcome</h4>
          {report.planned.map((p, i) => (
            <div className="review-outcome" key={i}>
              <b>{goals.find((g) => g.id === p.goalId)?.title || "Goal"}</b>
              <span>{p.outcome}</span>
              <p>{p.evidence}</p>
            </div>
          ))}
        </section>
      )}
      {[
        [report.unexpected, "What grew beyond the plan"],
        [report.lessons, "What to learn"],
        [report.nextYear, "What to take forward"],
        [report.questions, "Still worth asking"],
      ].map(
        ([items, label]: any) =>
          items.length > 0 && (
            <section key={label}>
              <h4>{label}</h4>
              <ul>
                {items.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
export function Sources({ onChanged }: { onChanged?: () => void }) {
  const [sources, setSources] = useState<SourceNote[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void api("sources")
      .then((d) => setSources(d.sources))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="source-section">
      <header className="sectiontitle">
        <h2>Your notebooks</h2>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!sources.length && !error && (
        <p className="muted">Imported notes will appear here.</p>
      )}
      <div className="source-grid">
        {sources.map((s) => (
          <SourceCard
            key={s.id + ":" + s.revision}
            source={s}
            onSave={async (d) => {
              try {
                const r = await api("sources/" + s.id, {
                  method: "PUT",
                  body: JSON.stringify({ ...d, revision: s.revision }),
                });
                setSources(r.sources);
                setError("");
                onChanged?.();
                return true;
              } catch (e) {
                setError((e as Error).message);
                return false;
              }
            }}
          />
        ))}
      </div>
    </section>
  );
}
function SourceCard({
  source: s,
  onSave,
}: {
  source: SourceNote;
  onSave: (d: { year: number | null; text: string }) => Promise<boolean>;
}) {
  const [year, setYear] = useState(s.year),
    [text, setText] = useState(s.text),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const now = new Date().getFullYear();
  return (
    <article className="source-card">
      {s.hasImage && (
        <a
          href={"/api/kurs/sources/" + s.id + "/image"}
          target="_blank"
          rel="noreferrer"
        >
          <div className="source-image">
            <img
              src={"/api/kurs/sources/" + s.id + "/image"}
              alt={s.title}
              loading="lazy"
            />
          </div>
        </a>
      )}
      <div className="source-content">
        <h3>{s.title}</h3>
        <label className="source-year">
          Notebook year
          <select
            aria-label={"Year for " + s.title}
            value={year ?? ""}
            onChange={(e) =>
              setYear(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Year to confirm</option>
            {Array.from({ length: 12 }, (_, i) => now + 1 - i).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <details>
          <summary>Read & correct transcription</summary>
          <textarea
            aria-label={"Transcription of " + s.title}
            rows={12}
            value={text}
            maxLength={30000}
            onChange={(e) => setText(e.target.value)}
          />
        </details>
        <button
          className="underlink"
          disabled={busy || (year === s.year && text === s.text)}
          onClick={async () => {
            setBusy(true);
            setSaved(await onSave({ year, text }));
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : saved ? "Saved" : "Save notebook details"}
          <Check size={14} />
        </button>
      </div>
    </article>
  );
}
export function Review({
  planner,
  year,
  years,
  chooseYear,
  save,
  busy,
  open,
  chat,
}: {
  planner: Planner;
  year: number;
  years: number[];
  chooseYear: (n: number) => void;
  save: (p: Planner) => Promise<boolean>;
  busy: boolean;
  open: (g: Goal) => void;
  chat: (prompt: string) => void;
}) {
  const initial = reviewFor(planner, year),
    [draft, setDraft] = useState<YearReview>(initial),
    [win, setWin] = useState(""),
    [area, setArea] = useState("Personal"),
    [message, setMessage] = useState("");
  const goals = planner.goals.filter((g) => g.year === year),
    previous = reviewFor(planner, year - 1);
  const setRating = (area: string, score: number) =>
    setDraft({
      ...draft,
      ratings: [
        ...draft.ratings.filter((r) => r.area !== area),
        ...(score ? [{ area, score }] : []),
      ],
    });
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return (
    <section>
      <header className="spread-title">
        <h1>
          A year lived<span>.</span>
        </h1>
        <label className="editionpick">
          Review year
          <select
            value={year}
            onChange={(e) => chooseYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="review-intro">
        <div>
          <span className="section-kicker">Reflecting on {year}</span>
          <h2>There is more to a year than the plan.</h2>
          <p>
            Notice what you achieved, what changed, and what turned out to
            matter.
          </p>
        </div>
        <button
          className="action-ink"
          disabled={busy || dirty}
          title={dirty ? "Save your reflection first" : undefined}
          onClick={() =>
            chat(
              "Help me review " +
                year +
                ". Compare my plans with what actually happened, including unexpected achievements. Use my notes and ask about missing evidence.",
            )
          }
        >
          <Sparkles size={16} />
          Reflect with Katya
        </button>
      </div>
      <div className="review-summary">
        <span>
          <b>{goals.filter((g) => g.achieved).length}</b>Goals achieved
        </span>
        <span>
          <b>
            {
              goals.filter(
                (g) => !g.achieved && (!g.status || g.status === "active"),
              ).length
            }
          </b>
          Still in progress
        </span>
        <span>
          <b>
            {
              goals.filter((g) =>
                ["changed", "released", "paused"].includes(g.status || ""),
              ).length
            }
          </b>
          Changed direction
        </span>
        <span>
          <b>{draft.wins.length}</b>Unexpected wins
        </span>
      </div>
      <div className="reflection-grid">
        <section className="reflection-card">
          <span className="section-kicker">The plan you started with</span>
          <h2>What happened?</h2>
          {goals.length ? (
            goals.map((g) => (
              <button
                className="review-goal"
                key={g.id}
                onClick={() => open(g)}
              >
                <span>
                  {g.title}
                  <small>{areaName(g.category)}</small>
                </span>
                <span>
                  {g.achieved ? "Achieved" : g.status || "In progress"}
                  <ArrowRight size={14} />
                </span>
              </button>
            ))
          ) : (
            <p className="muted">
              No goals recorded for {year}. Your notes and unexpected wins can
              still tell the story.
            </p>
          )}
          <label className="reflection-notes">
            What should you remember?
            <textarea
              rows={6}
              maxLength={20000}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="What gave you energy? What changed? What did you learn about yourself?"
            />
          </label>
        </section>
        <section className="reflection-card">
          <span className="section-kicker">Beyond the original plan</span>
          <h2>Unexpected wins</h2>
          <p className="muted">
            An opportunity, a relationship, something you learned, a change you
            chose.
          </p>
          {draft.wins.map((w) => (
            <div className="win-row" key={w.id}>
              <span>
                {w.title}
                <small>{w.area}</small>
              </span>
              <button
                className="iconbtn"
                aria-label={"Remove " + w.title}
                onClick={() =>
                  setDraft({
                    ...draft,
                    wins: draft.wins.filter((a) => a.id !== w.id),
                  })
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <form
            className="win-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (win.trim()) {
                setDraft({
                  ...draft,
                  wins: [
                    ...draft.wins,
                    { id: crypto.randomUUID(), title: win.trim(), area },
                  ],
                });
                setWin("");
              }
            }}
          >
            <label className="sr-only" htmlFor="unexpected-win">
              Unexpected achievement
            </label>
            <input
              id="unexpected-win"
              maxLength={1000}
              value={win}
              onChange={(e) => setWin(e.target.value)}
              placeholder="Something good you did not plan"
            />
            <select
              aria-label="Achievement area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className="secondary" disabled={!win.trim()}>
              <Plus size={16} />
              Add win
            </button>
          </form>
        </section>
      </div>
      <section className="life-section">
        <div>
          <span className="section-kicker">Your own assessment</span>
          <h2>How did each part of life feel?</h2>
          <p>
            Rate the year from 1 to 10. Leave an area blank if you are unsure.
          </p>
        </div>
        <div className="life-ratings">
          {categories.map((a) => {
            const score = draft.ratings.find((r) => r.area === a)?.score,
              prev = previous.ratings.find((r) => r.area === a)?.score;
            return (
              <label className="life-row" key={a}>
                <span>{a}</span>
                <span className="rating-track">
                  {Array.from({ length: 10 }, (_, i) => (
                    <i className={score && i < score ? "filled" : ""} key={i} />
                  ))}
                </span>
                <select
                  aria-label={a + " rating"}
                  value={score || ""}
                  onChange={(e) => setRating(a, Number(e.target.value))}
                >
                  <option value="">Unrated</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <small>
                  {prev ? year - 1 + " · " + prev : "/ 10"}
                  {prev && score
                    ? " · " + (score - prev > 0 ? "+" : "") + (score - prev)
                    : ""}
                </small>
              </label>
            );
          })}
        </div>
      </section>
      <div className="reflection-save">
        <button
          className="action-ink"
          disabled={busy || !dirty}
          onClick={async () => {
            if (await save(withReview(planner, draft)))
              setMessage("Reflection saved");
          }}
        >
          <Check size={16} />
          Save reflection
        </button>
        {message && <span role="status">{message}</span>}
        {dirty && (
          <span className="muted">
            Save before asking Katya to analyse these changes.
          </span>
        )}
      </div>
      {initial.report && (
        <section className="saved-review">
          <ReportView report={initial.report} goals={goals} />
          {initial.generatedAt && (
            <small>
              Saved {new Date(initial.generatedAt).toLocaleDateString("en-GB")}
            </small>
          )}
          <button
            className="underlink"
            disabled={dirty}
            onClick={() =>
              chat(
                "Update my year review using the latest journal. Suggest a few deliberate priorities for next year.",
              )
            }
          >
            Revisit with Katya
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      <Sources />
    </section>
  );
}
