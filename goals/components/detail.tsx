"use client";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Flag,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import {
  currentValue,
  day,
  finished,
  percent,
  uid,
  weekKey,
  type Goal,
  type Step,
} from "../planner";
export function Detail({
  g,
  busy,
  hasNext,
  onChange,
  onEdit,
  onAI,
  onCarry,
  onDelete,
  onFocus,
}: {
  g: Goal;
  busy: boolean;
  hasNext: boolean;
  onChange: (g: Goal) => Promise<boolean>;
  onEdit: () => void;
  onAI: () => void;
  onCarry: () => void;
  onDelete: () => void;
  onFocus: () => void;
}) {
  const [step, setStep] = useState(""),
    [value, setValue] = useState(""),
    [deleting, del] = useState(false),
    [editStep, setEditStep] = useState<string | null>(null),
    [renamed, rename] = useState("");
  const [when, setWhen] = useState(
    day().startsWith(g.year + "-")
      ? day()
      : g.year + (g.year < Number(day().slice(0, 4)) ? "-12-31" : "-01-01"),
  );
  function updateStep(id: string, props: Partial<Goal["steps"][number]>) {
    return onChange({
      ...g,
      steps: g.steps.map((s) => (s.id === id ? { ...s, ...props } : s)),
    });
  }
  return (
    <div className="detail">
      <div className="detailchips">
        <span className="badge">{g.category}</span>
        <span>{g.year}</span>
        {g.achieved && (
          <span className="badge">
            <Check size={13} />
            Achieved
          </span>
        )}
        <button className="iconbtn end" onClick={onEdit} title="Edit goal">
          <Pencil size={17} />
        </button>
      </div>
      <div className="metrics">
        <div>
          <small>Current result</small>
          <b>{currentValue(g) || "No result recorded"}</b>
        </div>
        <ArrowRight size={16} />
        <div>
          <small>Goal</small>
          <b>{g.target || "Add a success criterion"}</b>
        </div>
      </div>
      <div className="headingrow">
        <h3>Action plan</h3>
        <span className="micro">
          {finished(g)} / {g.steps.length}
        </span>
      </div>
      <div className="progress">
        <i style={{ width: percent(g) + "%" }} />
      </div>
      <div className="detailsteps">
        {g.steps.map((s) => (
          <div className="detailstep" key={s.id}>
            <button
              disabled={busy}
              role="checkbox"
              aria-checked={s.done}
              aria-label={s.title}
              onClick={() => updateStep(s.id, { done: !s.done })}
              className={"tick " + (s.done ? "checked" : "")}
            >
              {s.done && <Check size={14} />}
            </button>
            {editStep === s.id ? (
              <form
                className="lineform"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    renamed.trim() &&
                    (await updateStep(s.id, { title: renamed.trim() }))
                  )
                    setEditStep(null);
                }}
              >
                <input
                  maxLength={300}
                  aria-label="Step title"
                  autoFocus
                  value={renamed}
                  onChange={(e) => rename(e.target.value)}
                />
                <button
                  disabled={busy}
                  className="iconbtn"
                  aria-label="Save step"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Delete step"
                  onClick={async () => {
                    if (
                      await onChange({
                        ...g,
                        steps: g.steps.filter((x) => x.id !== s.id),
                      })
                    )
                      setEditStep(null);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </form>
            ) : (
              <>
                <button
                  className={"steptext " + (s.done ? "done" : "")}
                  title="Edit step"
                  onClick={() => {
                    setEditStep(s.id);
                    rename(s.title);
                  }}
                >
                  {s.title}
                  {s.milestone && <small>{s.milestone}</small>}
                  {s.date && (
                    <small>
                      {s.date} {s.time}{" "}
                      {s.minutes ? " · " + s.minutes + " min" : ""}
                    </small>
                  )}
                  {s.week && (
                    <small>
                      Week of{" "}
                      {new Date(s.week + "T12:00:00").toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </small>
                  )}
                </button>
                <StepSchedule
                  key={
                    s.id + (s.date || "") + (s.time || "") + (s.minutes || "")
                  }
                  step={s}
                  year={g.year}
                  busy={busy}
                  save={(props) => updateStep(s.id, props)}
                />
                <button
                  className={"iconbtn " + (s.week === weekKey() ? "on" : "")}
                  disabled={busy || g.year !== Number(day().slice(0, 4))}
                  title={
                    s.week === weekKey()
                      ? "Remove from this week"
                      : "Add to this week"
                  }
                  aria-label={
                    s.week === weekKey()
                      ? "Remove from this week"
                      : "Add to this week"
                  }
                  onClick={() =>
                    updateStep(s.id, {
                      week: s.week === weekKey() ? "" : weekKey(),
                    })
                  }
                >
                  <CalendarDays size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <form
        className="lineform"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            step.trim() &&
            (await onChange({
              ...g,
              steps: [
                ...g.steps,
                { id: uid(), title: step.trim(), done: false, week: "" },
              ],
            }))
          )
            setStep("");
        }}
      >
        <input
          maxLength={300}
          aria-label="New step"
          value={step}
          onChange={(e) => setStep(e.target.value)}
          placeholder="Add a concrete next step"
        />
        <button
          className="secondary"
          disabled={busy || !step.trim()}
          aria-label="Add step"
        >
          <Plus size={17} />
        </button>
      </form>
      <section>
        <h3>Results journal</h3>
        {g.entries.length > 0 && (
          <ul className="entries">
            {g.entries.map((e, i) => (
              <li key={i}>
                <time>{e.date.split("-").reverse().join(".")}</time>
                {e.value}
              </li>
            ))}
          </ul>
        )}
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              value.trim() &&
              (await onChange({
                ...g,
                entries: [
                  ...g.entries,
                  { date: when, value: value.trim() },
                ].sort((a, b) => a.date.localeCompare(b.date)),
              }))
            )
              setValue("");
          }}
        >
          <div className="lineform record">
            <input
              required
              type="date"
              aria-label="Result date"
              value={when}
              min={g.year + "-01-01"}
              max={g.year + "-12-31"}
              onChange={(e) => setWhen(e.target.value)}
            />
            <input
              maxLength={400}
              aria-label="Result"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="What changed?"
            />
          </div>
          <button className="secondary" disabled={busy || !value.trim()}>
            Record result
          </button>
        </form>
      </section>
      <div className="detailactions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => onChange({ ...g, achieved: !g.achieved })}
        >
          <CheckCheck size={16} />
          {g.achieved ? "Reopen goal" : "Mark achieved"}
        </button>
        <button
          className="secondary"
          disabled={busy || g.focus}
          onClick={onFocus}
        >
          <Star size={16} />
          {g.focus ? "In focus" : "Make this my focus"}
        </button>
        <button className="secondary" onClick={onAI}>
          <Sparkles size={16} />
          Discuss with Katya
        </button>
        <button
          className="secondary"
          disabled={busy || hasNext}
          onClick={onCarry}
        >
          <Flag size={16} />
          {hasNext
            ? "Already continued in " + (g.year + 1)
            : "Continue in " + (g.year + 1)}
        </button>
      </div>
      {deleting ? (
        <div className="notice">
          <p>Delete this {g.year} goal and all its steps and entries?</p>
          <button className="danger" disabled={busy} onClick={onDelete}>
            Delete
          </button>{" "}
          <button className="link" onClick={() => del(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="link muted" onClick={() => del(true)}>
          Delete this goal
        </button>
      )}
    </div>
  );
}

function StepSchedule({
  step,
  year,
  busy,
  save,
}: {
  step: Step;
  year: number;
  busy: boolean;
  save: (p: Partial<Step>) => Promise<boolean>;
}) {
  const [date, setDate] = useState(step.date || ""),
    [time, setTime] = useState(step.time || ""),
    [minutes, setMinutes] = useState(step.minutes || 30);
  return (
    <details className="step-schedule">
      <summary aria-label={"Schedule " + step.title}>
        <CalendarDays size={16} />
      </summary>
      <form
        className="schedule-fields"
        onSubmit={async (e) => {
          e.preventDefault();
          const el = e.currentTarget.parentElement as HTMLDetailsElement;
          if (await save({ date, time: date ? time : "", minutes, week: "" }))
            el.open = false;
        }}
      >
        <label>
          Date
          <input
            type="date"
            aria-label="Step date"
            value={date}
            min={year + "-01-01"}
            max={year + "-12-31"}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Time in Amsterdam
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          Minutes
          <input
            type="number"
            min={1}
            max={1440}
            required
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <button className="primary" disabled={busy}>
          Save time block
        </button>
        <button
          className="underlink"
          type="button"
          disabled={busy}
          onClick={async (e) => {
            const el = e.currentTarget.closest("details");
            if (await save({ date: "", time: "", minutes: 0 })) {
              setDate("");
              setTime("");
              if (el) el.open = false;
            }
          }}
        >
          Remove time block
        </button>
      </form>
    </details>
  );
}
