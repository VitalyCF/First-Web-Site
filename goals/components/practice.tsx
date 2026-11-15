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
  type Goal,
  type Habit,
} from "../planner";
const shortDays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const week = [1, 2, 3, 4, 5, 6, 0];
const displayDate = (d: string, options: Intl.DateTimeFormatOptions) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("ru", {
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
        После какого привычного события?
        <input
          required
          maxLength={300}
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          placeholder="После утреннего кофе"
        />
      </label>
      <label>
        Что ты сделаешь?
        <input
          required
          maxLength={300}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Сыграть один куплет на гитаре"
        />
      </label>
      <label>
        Сколько минут?
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
        Версия на две минуты
        <input
          required
          maxLength={300}
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
          placeholder="Взять гитару и сыграть один аккорд"
        />
      </label>
      <fieldset className="weekday-buttons">
        <legend>Дни недели</legend>
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
        Сохранить ритм
      </button>
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
  const date = startFor(g),
    inYear = date === day(),
    h = habitAt(g, date),
    record = g.practice?.find((x) => x.date === date),
    isDue = planned(g, date);
  const next = g.steps.find((x) => !x.done);
  return (
    <>
      <article className="today-box">
        <div className="note-label">
          <span className="sun-dot" />
          {displayDate(date, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <div className="practice-head">
          <h2>
            {g.achieved
              ? "Цель достигнута"
              : !inYear
                ? "Ритм на " + g.year + " год"
                : record
                  ? "Сегодня сделано"
                  : h
                    ? isDue
                      ? "Действие на сегодня"
                      : "Свободный день"
                    : "Первое маленькое действие"}
          </h2>
          {!g.achieved && (
            <button
              className="iconbtn"
              onClick={edit}
              aria-label="Настроить ритм"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
        {g.achieved ? (
          <p>{g.entries.at(-1)?.value || g.target}</p>
        ) : !inYear ? (
          <>
            <p>{h?.action || "Для этого года можно задать свой ритм."}</p>
            <button className="underlink" onClick={edit}>
              Настроить расписание
            </button>
          </>
        ) : record ? (
          <>
            <p className="practice-action">{record.action}</p>
            <button
              className="underlink"
              disabled={busy}
              onClick={() => change(checkPractice(g, date, "undo"))}
            >
              Снять отметку за сегодня
            </button>
          </>
        ) : h ? (
          <>
            <p className="cue">{h.cue}</p>
            <p className="practice-action">{h.action}</p>
            <span className="practice-time">
              <Clock size={14} />
              {h.minutes} мин ·{" "}
              {week
                .filter((d) => h.days.includes(d))
                .map((d) => shortDays[d])
                .join(" · ")}
            </span>
            <div className="practice-buttons">
              <button
                className="action-ink"
                disabled={busy}
                onClick={() => change(checkPractice(g, date, "full"))}
              >
                <Check size={16} />{" "}
                {isDue ? "Отметить занятие" : "Занимался сегодня"}
              </button>
              <button
                className="minimum"
                disabled={busy}
                onClick={() => change(checkPractice(g, date, "minimum"))}
              >
                Сделал минимум · 2 мин
              </button>
            </div>
            <p className="minimum-copy">{h.minimum}</p>
          </>
        ) : (
          <>
            <p>
              Выбери момент дня и действие, которое легко повторить даже в
              загруженный день.
            </p>
            <button className="action-ink" onClick={edit}>
              <Plus size={16} />
              Задать ритм
            </button>
          </>
        )}
        {!g.achieved && (
          <button
            className="underlink coach-link"
            onClick={() =>
              coach(
                h
                  ? "Помоги упростить моё ежедневное действие."
                  : "Помоги превратить эту цель в небольшую привычку с привязкой и версией на две минуты.",
              )
            }
          >
            <Sparkles size={15} />
            Подобрать с Катей
          </button>
        )}
      </article>
      <section className="plan-list">
        <header>
          <div>
            <span className="section-kicker">План цели</span>
            <h2>Ближайшие шаги</h2>
          </div>
          <button className="underlink" onClick={open}>
            Редактировать
          </button>
        </header>
        {g.steps.map((s, i) => (
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
                    x.id === s.id ? { ...x, done: !s.done } : x,
                  ),
                })
              }
            >
              {s.done ? <Check size={15} /> : i + 1}
            </button>
            <span>
              {s.title}
              {s.id === next?.id && <small>Следующий шаг</small>}
            </span>
          </div>
        ))}
        {!g.steps.length && (
          <button className="underlink" onClick={open}>
            <Plus size={16} />
            Добавить первый шаг
          </button>
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
function daysOfMonth(date: string) {
  const start = new Date(monthStart(date, 0) + "T12:00:00Z");
  const pad = (start.getUTCDay() + 6) % 7;
  const end = new Date(monthStart(date, 1) + "T12:00:00Z");
  end.setUTCDate(0);
  return {
    pad,
    dates: Array.from(
      { length: end.getUTCDate() },
      (_, i) => date.slice(0, 7) + "-" + String(i + 1).padStart(2, "0"),
    ),
  };
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
    [filter, setFilter] = useState("all");
  const today = day();
  const shown = goals.filter(
    (g) =>
      g.year === Number(selected.slice(0, 4)) &&
      (filter === "all" || g.id === filter),
  );
  const { pad, dates } = daysOfMonth(selected);
  const status = (d: string) => {
    const batch = shown.filter((g) => g.practice?.some((p) => p.date === d));
    return batch.length
      ? "done"
      : shown.some((g) => planned(g, d))
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
          Календарь<span>.</span>
        </h1>
        <button
          className="underlink"
          onClick={() => {
            setDate(today);
            setFilter("all");
          }}
        >
          Сегодня
        </button>
      </header>
      <div className="calendar-layout">
        <section className="month">
          <header>
            <h2>{displayDate(selected, { month: "long", year: "numeric" })}</h2>
            <div>
              <button aria-label="Предыдущий месяц" onClick={() => move(-1)}>
                <ChevronLeft size={20} />
              </button>
              <button aria-label="Следующий месяц" onClick={() => move(1)}>
                <ChevronRight size={20} />
              </button>
            </div>
          </header>
          <label>
            <select
              aria-label="Фильтр целей"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Все цели</option>
              {goals
                .filter((g) => g.year === Number(selected.slice(0, 4)))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </label>
          <div className="date-grid">
            {week.map((n) => (
              <span key={n}>{shortDays[n]}</span>
            ))}
            {Array.from({ length: pad }, (_, i) => (
              <i key={"pad" + i} />
            ))}
            {dates.map((d) => (
              <button
                key={d}
                className={
                  "date " + status(d) + (d === today ? " date-today" : "")
                }
                aria-label={
                  displayDate(d, { day: "numeric", month: "long" }) +
                  " " +
                  {
                    done: "занятие",
                    missed: "без отметки",
                    scheduled: "запланировано",
                    rest: "свободно",
                  }[status(d)]
                }
                aria-pressed={d === selected}
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
              Сделано
            </span>
            <span>
              <i className="dot-plan" />В плане
            </span>
            <span>
              <i className="dot-missed" />
              Без отметки
            </span>
          </footer>
        </section>
        <aside className="day-detail">
          <span className="section-kicker">Дневник практики</span>
          <h2>{displayDate(selected, { day: "numeric", month: "long" })}</h2>
          {shown
            .filter(
              (g) =>
                planned(g, selected) ||
                g.practice?.some((p) => p.date === selected),
            )
            .map((g) => {
              const record = g.practice?.find((p) => p.date === selected),
                h = habitAt(g, selected);
              return (
                <article key={g.id}>
                  <button className="underlink" onClick={() => open(g)}>
                    {g.title}
                  </button>
                  <p>{record?.action || h?.action}</p>
                  <small>
                    {record
                      ? record.kind === "minimum"
                        ? "Сделан минимум"
                        : "Занятие выполнено"
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
                          Снять отметку
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              change(checkPractice(g, selected, "full"))
                            }
                          >
                            Сделано
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              change(checkPractice(g, selected, "minimum"))
                            }
                          >
                            Сделал минимум
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          {!shown.some(
            (g) =>
              planned(g, selected) ||
              g.practice?.some((p) => p.date === selected),
          ) && <p>На этот день занятий нет.</p>}
        </aside>
      </div>
    </section>
  );
}
