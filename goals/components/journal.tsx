"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleDot,
  Flag,
  Focus,
  Guitar,
  Layers,
  Mountain,
  Plus,
  Sparkles,
} from "lucide-react";
import { finished, type Goal } from "../planner";

export function Masthead({
  view,
  onCalendar,
  onFocus,
  onYear,
  onNew,
}: {
  view: string;
  onCalendar: () => void;
  onFocus: () => void;
  onYear: () => void;
  onNew: () => void;
}) {
  return (
    <header className="mast">
      <div className="mast-inner">
        <button
          className="wordmark"
          onClick={onFocus}
          aria-label="Курс, в фокусе"
        >
          <span className="kursmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Курс<span className="branddot">.</span>
        </button>
        <nav className="view-switch" aria-label="Вид журнала">
          <button onClick={onFocus} aria-pressed={view === "overview"}>
            <Focus size={16} />В фокусе
          </button>
          <button
            onClick={onYear}
            aria-pressed={["goals", "history", "week"].includes(view)}
          >
            <Layers size={16} />
            Мой год
          </button>
          <button onClick={onCalendar} aria-pressed={view === "calendar"}>
            <CalendarDays size={16} />
            Календарь
          </button>
        </nav>
        <button className="add-goal" onClick={onNew}>
          <Plus size={17} />
          <span>Новая цель</span>
        </button>
      </div>
    </header>
  );
}

function Cover({ small = false }: { small?: boolean }) {
  return (
    <picture className="alpine" aria-hidden="true">
      <source
        media="(max-width: 700px)"
        srcSet="/goals-media/alpine-ridge-800.webp"
      />
      <img
        src="/goals-media/alpine-ridge-1600.webp"
        alt=""
        fetchPriority={small ? "auto" : "high"}
      />
    </picture>
  );
}

export function FocusSpread({
  goal,
  year,
  onOpen,
  onCreate,
  onCoach,
  children,
}: {
  goal?: Goal;
  year: number;
  onOpen: () => void;
  onCreate: () => void;
  onCoach: () => void;
  children?: React.ReactNode;
}) {
  return (
    <section className="focus-spread">
      <header className="spread-title">
        <h1>
          В фокусе<span>.</span>
        </h1>
        <span className="journal-year">
          Личный журнал <i /> {year}
        </span>
      </header>
      <div className="focus-pair">
        <article className="cover-story">
          <Cover />
          <div className="cover-filter" />
          <div className="cover-meta">
            <span className="category-flag">
              <i />
              {goal?.category || "Новая глава"}
            </span>
            <span>{year}</span>
          </div>
          <div className="cover-copy">
            <h2>{goal?.title || "С чего начнётся твой год?"}</h2>
            {goal?.target && <p className="cover-target">{goal.target}</p>}
            <button className="cover-link" onClick={goal ? onOpen : onCreate}>
              {goal ? "Открыть цель" : "Создать цель"}
              <ArrowUpRight size={17} />
            </button>
          </div>
        </article>
        {children || (
          <article className="next-note">
            <div className="note-label">
              <span className="sun-dot" />
              Первый шаг
            </div>
            <h2>Что хочется делать понемногу весь год?</h2>
            <button className="action-ink" onClick={onCreate}>
              Записать цель <Plus size={16} />
            </button>
            <button className="underlink" onClick={onCoach}>
              <Sparkles size={16} />
              Придумать вместе с Катей
            </button>
          </article>
        )}
      </div>
    </section>
  );
}

function symbol(g: Goal) {
  if (g.achieved) return Flag;
  if (g.category === "Спорт") return Mountain;
  if (g.category === "Обучение") return BookOpen;
  if (g.category === "Хобби") return Guitar;
  return CircleDot;
}

function GoalRow({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const Icon = symbol(goal);
  return (
    <button className="journal-row" onClick={onOpen}>
      <span className="row-symbol">
        <Icon size={19} strokeWidth={1.6} />
      </span>
      <span className="row-name">
        <small>{goal.category}</small>
        <b>{goal.title}</b>
      </span>
      <span className="row-status">
        {goal.achieved ? (
          <>
            <Check size={14} />
            Достигнута
          </>
        ) : goal.focus ? (
          <>
            <Focus size={14} />В фокусе
          </>
        ) : (
          <>
            {finished(goal)} / {goal.steps.length} шагов
          </>
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
        <h2>Цели года</h2>
        <button className="underlink" onClick={onYear}>
          Весь год <ArrowRight size={15} />
        </button>
      </header>
      <div>
        {goals.slice(0, 3).map((g) => (
          <GoalRow key={g.id} goal={g} onOpen={() => open(g)} />
        ))}
      </div>
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
  onCoach,
  onHistory,
  onWeek,
}: {
  goals: Goal[];
  year: number;
  years: number[];
  chooseYear: (y: number) => void;
  open: (g: Goal) => void;
  onCreate: () => void;
  onCoach: () => void;
  onHistory: () => void;
  onWeek: () => void;
}) {
  const [area, setArea] = useState("Все сферы");
  const areas = Array.from(new Set(goals.map((g) => g.category)));
  const shown = goals.filter(
    (g) => area === "Все сферы" || g.category === area,
  );
  return (
    <section>
      <header className="spread-title">
        <h1>
          Мой год<span>.</span>
        </h1>
        <label className="editionpick">
          Год{" "}
          <select
            aria-label="Год журнала"
            value={year}
            onChange={(e) => {
              chooseYear(Number(e.target.value));
              setArea("Все сферы");
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </header>
      <div className="annual-cover">
        <Cover small />
        <div className="cover-filter" />
        <strong>{year}</strong>
        <div className="annual-count">
          <span>
            <b>{goals.length}</b>Всего целей
          </span>
          <span>
            <b>{goals.filter((g) => g.achieved).length}</b>Достигнуто
          </span>
        </div>
      </div>
      <div className="year-tools">
        <div className="areas">
          {["Все сферы", ...areas].map((c) => (
            <button
              key={c}
              aria-pressed={c === area}
              onClick={() => setArea(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button className="underlink" onClick={onHistory}>
          История <ArrowUpRight size={15} />
        </button>
      </div>
      {shown.map((g) => (
        <GoalRow goal={g} key={g.id} onOpen={() => open(g)} />
      ))}
      {!shown.length && (
        <div className="annual-empty">
          <h2>Каким ты хочешь запомнить {year}?</h2>
          <button className="action-ink" onClick={onCreate}>
            <Plus size={16} />
            Добавить цель
          </button>
        </div>
      )}
      <div className="year-links">
        <button className="underlink" onClick={onCoach}>
          <Sparkles size={16} />
          Придумать цель с Катей
        </button>
        <button className="underlink" onClick={onWeek}>
          Шаги недели <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
