import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  checkPractice,
  day,
  habitAt,
  planned,
  putHabit,
  stopHabit,
  type Goal,
  type Habit,
} from "../planner";
const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const week = [1, 2, 3, 4, 5, 6, 0];
const displayDate = (d: string, options: Intl.DateTimeFormatOptions) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
    timeZone: "UTC",
    ...options,
  });
export const startFor = (g: Goal) =>
  day().startsWith(g.year + "-")
    ? day()
    : g.year + (g.year < Number(day().slice(0, 4)) ? "-12-31" : "-01-01");
export function HabitForm({
  g,
  draft,
  onSave,
  busy,
}: {
  g: Goal;
  draft?: Partial<Habit>;
  onSave: (g: Goal) => Promise<boolean>;
  busy: boolean;
}) {
  const since = startFor(g);
  const existing = draft || habitAt(g, since);
  const [cue, setCue] = useState(existing?.cue || ""),
    [action, setAction] = useState(existing?.action || ""),
    [minimum, setMinimum] = useState(existing?.minimum || ""),
    [minutes, setMinutes] = useState(existing?.minutes || 5),
    [days, setDays] = useState(existing?.days || [1, 2, 3, 4, 5, 6, 0]);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (days.length && action.trim() && minimum.trim() && cue.trim())
          void onSave(
            putHabit(g, {
              since,
              cue: cue.trim(),
              action: action.trim(),
              minimum: minimum.trim(),
              minutes,
              days: [...days].sort(),
            }),
          );
      }}
    >
      <label>
        After which familiar moment?
        <input
          required
          maxLength={300}
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          placeholder="After my morning coffee"
        />
      </label>
      <label>
        What will you do?
        <input
          required
          maxLength={300}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Play one verse on the guitar"
        />
      </label>
      <label>
        How many minutes?
        <input
          type="number"
          required
          min={1}
          max={180}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </label>
      <label>
        An easier version for a busy day
        <input
          required
          maxLength={300}
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
          placeholder="Pick up the guitar and play one chord"
        />
      </label>
      <fieldset className="weekday-buttons">
        <legend>Days of the week</legend>
        {week.map((d) => (
          <button
            type="button"
            key={d}
            aria-pressed={days.includes(d)}
            onClick={() =>
              setDays(
                days.includes(d) ? days.filter((x) => x !== d) : [...days, d],
              )
            }
          >
            {shortDays[d]}
          </button>
        ))}
      </fieldset>
      <button className="primary full" disabled={busy || !days.length}>
        Save routine
      </button>
      {habitAt(g, since) && (
        <button
          className="underlink"
          type="button"
          disabled={busy}
          onClick={() => void onSave(stopHabit(g, since))}
        >
          Stop the routine and keep my history
        </button>
      )}
    </form>
  );
}
export function Today({
  g,
  busy,
  change,
  edit,
  coach,
  open,
}: {
  g: Goal;
  busy: boolean;
  change: (g: Goal) => Promise<boolean>;
  edit: () => void;
  coach: (p: string) => void;
  open: () => void;
}) {
  const date = day(),
    inYear = date.startsWith(g.year + "-"),
    h = inYear ? habitAt(g, date) : undefined,
    record = g.practice?.find((p) => p.date === date),
    next = g.steps.find((s) => !s.done);
  const groups = [...new Set(g.steps.map((s) => s.milestone || "Next steps"))];
  return (
    <>
      <article className="today-box">
        <div className="note-label">
          <span className="sun-dot" />
          {inYear
            ? displayDate(date, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : g.year + " plan"}
        </div>
        <div className="practice-head">
          <h2>
            {g.achieved
              ? "You made it"
              : h && record
                ? "Today is recorded"
                : h
                  ? "Your next practice"
                  : next
                    ? "Your next move"
                    : "Room for a next step"}
          </h2>
        </div>
        {g.achieved ? (
          <p>{g.entries.at(-1)?.value || g.target}</p>
        ) : h ? (
          <>
            <p className="cue">{h.cue}</p>
            <p className="practice-action">{record?.action || h.action}</p>
            <span className="practice-time">
              <Clock size={14} />
              {h.minutes} min ·{" "}
              {week
                .filter((d) => h.days.includes(d))
                .map((d) => shortDays[d])
                .join(" · ")}
            </span>
            {record ? (
              <button
                className="underlink"
                disabled={busy}
                onClick={() => change(checkPractice(g, date, "undo"))}
              >
                Undo today's check-in
              </button>
            ) : (
              <div className="practice-buttons">
                <button
                  className="action-ink"
                  disabled={busy}
                  onClick={() => change(checkPractice(g, date, "full"))}
                >
                  <Check size={16} />
                  Done for today
                </button>
                <button
                  className="minimum"
                  disabled={busy}
                  onClick={() => change(checkPractice(g, date, "minimum"))}
                >
                  Did the easier version
                </button>
              </div>
            )}
            <p className="minimum-copy">{h.minimum}</p>
            <button className="underlink" onClick={edit}>
              Adjust routine
            </button>
          </>
        ) : next ? (
          <>
            <p className="practice-action">{next.title}</p>
            {next.milestone && <p className="cue">{next.milestone}</p>}
            {(next.date || next.minutes) && (
              <span className="practice-time">
                <Clock size={14} />
                {[
                  next.date,
                  next.time,
                  next.minutes ? next.minutes + " min" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            <button
              disabled={busy}
              className="action-ink"
              onClick={() =>
                change({
                  ...g,
                  steps: g.steps.map((s) =>
                    s.id === next.id ? { ...s, done: true } : s,
                  ),
                })
              }
            >
              <Check size={16} />
              Mark step done
            </button>
            <button className="underlink" onClick={open}>
              Set aside time
            </button>
          </>
        ) : (
          <>
            <p>Revisit the outcome and choose what is worth doing next.</p>
            <button
              className="action-ink"
              onClick={() =>
                coach("Help me choose the next concrete step for this goal.")
              }
            >
              <Sparkles size={16} />
              Think it through
            </button>
          </>
        )}
        {!g.achieved && (
          <button
            className="underlink coach-link"
            onClick={() =>
              coach(
                "Help me find the right approach to this goal, including milestones, resources, and time I should set aside.",
              )
            }
          >
            <Sparkles size={15} />
            Work on this with Katya
          </button>
        )}
      </article>
      <section className="plan-list">
        <header>
          <div>
            <span className="section-kicker">Your route forward</span>
            <h2>Milestones & next steps</h2>
          </div>
          <button className="underlink" onClick={open}>
            Edit plan
          </button>
        </header>
        {g.why && <p className="goal-why">{g.why}</p>}
        {groups.map((m) => (
          <div key={m}>
            {groups.length > 1 || m !== "Next steps" ? (
              <h3 className="milestone-heading">{m}</h3>
            ) : null}
            {g.steps
              .filter((s) => (s.milestone || "Next steps") === m)
              .map((s) => (
                <div
                  className={
                    "path-step " +
                    (s.done ? "was-done" : s.id === next?.id ? "is-next" : "")
                  }
                  key={s.id}
                >
                  <button
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={s.title}
                    disabled={busy}
                    onClick={() =>
                      change({
                        ...g,
                        steps: g.steps.map((x) =>
                          x.id === s.id ? { ...x, done: !x.done } : x,
                        ),
                      })
                    }
                  >
                    {s.done ? <Check size={15} /> : g.steps.indexOf(s) + 1}
                  </button>
                  <span>
                    {s.title}
                    {s.id === next?.id && <small>Next step</small>}
                    {s.date && (
                      <small>
                        {s.date} {s.time}{" "}
                        {s.minutes ? "· " + s.minutes + " min" : ""}
                      </small>
                    )}
                  </span>
                </div>
              ))}
          </div>
        ))}
        {!g.steps.length && (
          <button
            className="underlink"
            onClick={() =>
              coach(
                "Help me create a practical plan with subgoals and next steps.",
              )
            }
          >
            <Sparkles size={15} />
            Build the plan together
          </button>
        )}
        {g.resources && (
          <p className="resources-note">
            <b>Resources & support</b>
            {g.resources}
          </p>
        )}
      </section>
    </>
  );
}
function monthStart(date: string, offset: number) {
  const d = new Date(date.slice(0, 7) + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
export function Calendar({
  goals,
  initial,
  change,
  open,
  busy,
}: {
  goals: Goal[];
  initial: string;
  change: (g: Goal) => Promise<boolean>;
  open: (g: Goal) => void;
  busy: boolean;
}) {
  const [selected, setDate] = useState(initial),
    [filter, setFilter] = useState("all"),
    today = day();
  const shown = goals.filter(
    (g) =>
      g.year === Number(selected.slice(0, 4)) &&
      (filter === "all" || g.id === filter),
  );
  const first = monthStart(selected, 0),
    pad = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7,
    last = new Date(monthStart(selected, 1) + "T12:00:00Z");
  last.setUTCDate(0);
  const dates = Array.from(
    { length: last.getUTCDate() },
    (_, i) => selected.slice(0, 7) + "-" + String(i + 1).padStart(2, "0"),
  );
  const tasks = (d: string) =>
    shown.flatMap((g) =>
      g.steps.filter((s) => s.date === d).map((s) => ({ g, s })),
    );
  const habits = (d: string) =>
    shown.filter((g) => planned(g, d) || g.practice?.some((p) => p.date === d));
  const status = (d: string) => {
    const a = tasks(d),
      h = habits(d),
      done =
        a.filter((x) => x.s.done).length +
        h.filter((g) => g.practice?.some((p) => p.date === d)).length,
      total = a.length + h.length;
    return total && done === total
      ? "done"
      : done
        ? "partial"
        : total
          ? d < today
            ? "missed"
            : "scheduled"
          : "rest";
  };
  function move(n: number) {
    const next = monthStart(selected, n);
    setDate(next);
    if (next.slice(0, 4) !== selected.slice(0, 4)) setFilter("all");
  }
  return (
    <section className="calendar">
      <header className="spread-title">
        <h1>
          Make time<span>.</span>
        </h1>
        <button
          className="underlink"
          onClick={() => {
            setDate(today);
            setFilter("all");
          }}
        >
          Today
        </button>
      </header>
      <div className="calendar-layout">
        <section className="month">
          <header>
            <h2>{displayDate(selected, { month: "long", year: "numeric" })}</h2>
            <div>
              <button aria-label="Previous month" onClick={() => move(-1)}>
                <ChevronLeft size={20} />
              </button>
              <button aria-label="Next month" onClick={() => move(1)}>
                <ChevronRight size={20} />
              </button>
            </div>
          </header>
          <select
            aria-label="Filter goals"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All goals</option>
            {goals
              .filter((g) => g.year === Number(selected.slice(0, 4)))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
          <div className="date-grid">
            {week.map((d) => (
              <span key={d}>{shortDays[d]}</span>
            ))}
            {Array.from({ length: pad }, (_, i) => (
              <i key={"pad" + i} />
            ))}
            {dates.map((d) => (
              <button
                className={
                  "date " + status(d) + (d === today ? " date-today" : "")
                }
                key={d}
                aria-pressed={d === selected}
                aria-label={
                  displayDate(d, { day: "numeric", month: "long" }) +
                  " " +
                  status(d)
                }
                onClick={() => setDate(d)}
              >
                {Number(d.slice(-2))}
                <i />
              </button>
            ))}
          </div>
          <footer className="legend">
            <span>
              <i className="dot-done" />
              Done
            </span>
            <span>
              <i className="dot-plan" />
              Planned
            </span>
            <span>
              <i className="dot-partial" />
              Partly done
            </span>
            <span>
              <i className="dot-missed" />
              No check-in
            </span>
          </footer>
        </section>
        <aside className="day-detail">
          <span className="section-kicker">Time set aside · Amsterdam</span>
          <h2>{displayDate(selected, { day: "numeric", month: "long" })}</h2>
          {tasks(selected)
            .sort((a, b) => (a.s.time || "99").localeCompare(b.s.time || "99"))
            .map(({ g, s }) => (
              <article key={s.id}>
                <button className="underlink" onClick={() => open(g)}>
                  {g.title}
                </button>
                <p>{s.title}</p>
                <small>
                  {[s.time, s.minutes ? s.minutes + " min" : "", s.milestone]
                    .filter(Boolean)
                    .join(" · ") || "Time to be decided"}
                </small>
                <div className="mini-actions">
                  <button
                    disabled={busy || selected > today}
                    onClick={() =>
                      change({
                        ...g,
                        steps: g.steps.map((t) =>
                          t.id === s.id ? { ...t, done: !t.done } : t,
                        ),
                      })
                    }
                  >
                    {s.done ? "Undo completion" : "Mark done"}
                  </button>
                </div>
              </article>
            ))}
          {habits(selected).map((g) => {
            const h = habitAt(g, selected),
              record = g.practice?.find((p) => p.date === selected);
            return (
              <article key={g.id}>
                <button className="underlink" onClick={() => open(g)}>
                  {g.title}
                </button>
                <p>{record?.action || h?.action}</p>
                <small>
                  {record
                    ? record.kind === "minimum"
                      ? "Easier version completed"
                      : "Practice completed"
                    : h?.cue}
                </small>
                {selected <= today && (
                  <div className="mini-actions">
                    {record ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          change(checkPractice(g, selected, "undo"))
                        }
                      >
                        Undo check-in
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            change(checkPractice(g, selected, "full"))
                          }
                        >
                          Done
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            change(checkPractice(g, selected, "minimum"))
                          }
                        >
                          Easier version
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {!tasks(selected).length && !habits(selected).length && (
            <p>No time blocks or routines scheduled.</p>
          )}
        </aside>
      </div>
      {shown.some((g) => g.steps.some((s) => !s.done && !s.date)) && (
        <section className="unscheduled">
          <h2>Waiting for a time</h2>
          {shown
            .filter((g) => g.steps.some((s) => !s.done && !s.date))
            .map((g) => (
              <button
                className="journal-row"
                onClick={() => open(g)}
                key={g.id}
              >
                <span className="row-name">
                  <b>{g.title}</b>
                  <small>
                    {g.steps.filter((s) => !s.done && !s.date).length}{" "}
                    unscheduled steps
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
        </section>
      )}
    </section>
  );
}
