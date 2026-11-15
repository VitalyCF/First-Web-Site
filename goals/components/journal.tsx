import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Focus,
  Guitar,
  Layers,
  Mountain,
  Plus,
  Sparkles,
} from "lucide-react";
import { areaName, finished, strategyName, type Goal } from "../planner";
export function Masthead({
  view,
  go,
  onNew,
}: {
  view: string;
  go: (v: string) => void;
  onNew: () => void;
}) {
  return (
    <header className="mast">
      <div className="mast-inner">
        <button
          className="wordmark"
          onClick={() => go("focus")}
          aria-label="Kurs, focus"
        >
          <span className="kursmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Kurs<span className="branddot">.</span>
        </button>
        <nav className="view-switch" aria-label="Journal view">
          {[
            ["focus", "Focus", Focus],
            ["year", "Year", Layers],
            ["calendar", "Calendar", CalendarDays],
            ["review", "Review", BookOpen],
          ].map(([v, label, Icon]: any) => (
            <button key={v} aria-pressed={view === v} onClick={() => go(v)}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
        <button className="add-goal" onClick={onNew}>
          <Plus size={17} />
          <span>New goal</span>
        </button>
      </div>
    </header>
  );
}
function Cover() {
  return (
    <picture className="alpine" aria-hidden="true">
      <source
        media="(max-width:700px)"
        srcSet="/goals-media/alpine-ridge-800.webp"
      />
      <img
        src="/goals-media/alpine-ridge-1600.webp"
        alt=""
        fetchPriority="high"
      />
    </picture>
  );
}
export function FocusSpread({
  goal,
  year,
  onOpen,
  onCreate,
  children,
}: {
  goal?: Goal;
  year: number;
  onOpen: () => void;
  onCreate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <header className="spread-title">
        <h1>
          In focus<span>.</span>
        </h1>
        <span className="journal-year">
          Your personal journal <i />
          {year}
        </span>
      </header>
      <div className="focus-pair">
        <article className="cover-story">
          <Cover />
          <div className="cover-filter" />
          <div className="cover-meta">
            <span className="category-flag">
              <i />
              {goal ? areaName(goal.category) : "A new chapter"}
            </span>
            <span>{goal ? strategyName(goal.strategy) : year}</span>
          </div>
          <div className="cover-copy">
            <h2>{goal?.title || "What would make this year yours?"}</h2>
            {goal?.target && <p className="cover-target">{goal.target}</p>}
            <button className="cover-link" onClick={goal ? onOpen : onCreate}>
              {goal ? "Open goal" : "Talk it through"}
              <ArrowUpRight size={17} />
            </button>
          </div>
        </article>
        {children || (
          <article className="next-note">
            <div className="note-label">
              <span className="sun-dot" />
              Start with an idea
            </div>
            <h2>You bring the idea. We work out the plan.</h2>
            <p>
              Talk with Katya about what matters, what is realistic, and how to
              begin.
            </p>
            <button className="action-ink" onClick={onCreate}>
              <Sparkles size={16} />
              Create a goal together
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
function GoalRow({ g, open }: { g: Goal; open: (g: Goal) => void }) {
  const Icon =
    areaName(g.category) === "Sport"
      ? Mountain
      : areaName(g.category) === "Hobbies"
        ? Guitar
        : BookOpen;
  return (
    <button className="journal-row" onClick={() => open(g)}>
      <span className="row-symbol">
        <Icon size={19} />
      </span>
      <span className="row-name">
        <small>
          {areaName(g.category)} · {strategyName(g.strategy)}
        </small>
        <b>{g.title}</b>
      </span>
      <span className="row-status">
        {g.achieved ? (
          <>
            <Check size={14} />
            Achieved
          </>
        ) : g.status && g.status !== "active" ? (
          g.status
        ) : g.focus ? (
          "In focus"
        ) : (
          finished(g) + " / " + g.steps.length + " steps"
        )}
      </span>
      <ArrowUpRight size={18} />
    </button>
  );
}
export function YearStrip({
  goals,
  open,
  onYear,
}: {
  goals: Goal[];
  open: (g: Goal) => void;
  onYear: () => void;
}) {
  return (
    <section className="year-strip">
      <header>
        <h2>This year's goals</h2>
        <button className="underlink" onClick={onYear}>
          The whole year
          <ArrowRight size={15} />
        </button>
      </header>
      {goals.slice(0, 4).map((g) => (
        <GoalRow key={g.id} g={g} open={open} />
      ))}
    </section>
  );
}
export function YearSpread({
  goals,
  year,
  years,
  chooseYear,
  open,
  onCreate,
  onReview,
}: {
  goals: Goal[];
  year: number;
  years: number[];
  chooseYear: (n: number) => void;
  open: (g: Goal) => void;
  onCreate: () => void;
  onReview: () => void;
}) {
  const [area, setArea] = useState("All areas");
  const shown = goals.filter(
    (g) => area === "All areas" || areaName(g.category) === area,
  );
  return (
    <section>
      <header className="spread-title">
        <h1>
          My year<span>.</span>
        </h1>
        <label className="editionpick">
          Year
          <select
            value={year}
            onChange={(e) => {
              chooseYear(Number(e.target.value));
              setArea("All areas");
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="annual-cover">
        <Cover />
        <div className="cover-filter" />
        <strong>{year}</strong>
        <div className="annual-count">
          <span>
            <b>{goals.length}</b>Goals
          </span>
          <span>
            <b>{goals.filter((g) => g.achieved).length}</b>Achieved
          </span>
        </div>
      </div>
      <div className="year-tools">
        <div className="areas">
          {[
            "All areas",
            ...new Set(goals.map((g) => areaName(g.category))),
          ].map((a) => (
            <button
              key={a}
              aria-pressed={a === area}
              onClick={() => setArea(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <button className="underlink" onClick={onReview}>
          Reflect on {year}
          <ArrowUpRight size={15} />
        </button>
      </div>
      {shown.map((g) => (
        <GoalRow key={g.id} g={g} open={open} />
      ))}
      {!shown.length && (
        <div className="annual-empty">
          <h2>What do you want to make room for?</h2>
          <button className="action-ink" onClick={onCreate}>
            <Sparkles size={16} />
            Think it through with Katya
          </button>
        </div>
      )}
    </section>
  );
}
