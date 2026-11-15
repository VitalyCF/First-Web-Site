"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  carryGoal,
  day,
  putHabit,
  validPlanner,
  weekKey,
  type Goal,
  type Planner,
} from "./planner";
import {
  Masthead,
  FocusSpread,
  YearSpread,
  YearStrip,
} from "./components/journal";
import { Editor, type Draft } from "./components/goal-editor";
import { Detail } from "./components/detail";
import { Calendar, Today, HabitForm, startFor } from "./components/practice";
import { Login } from "./components/login";
import { Coach, type Proposal } from "./components/coach";
type View = "overview" | "goals" | "week" | "history" | "calendar";
type Modal = {
  kind: "detail" | "edit" | "new" | "coach" | "habit";
  proposal?: Proposal;
  id?: string;
  draft?: Draft;
  prompt?: string;
};
const dateLabel = (d: string, options: Intl.DateTimeFormatOptions) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("ru-RU", {
    timeZone: "UTC",
    ...options,
  });
function shiftDate(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function word(n: number, one: string, few: string, many: string) {
  return n % 10 === 1 && n % 100 !== 11
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)
      ? few
      : many;
}
function ModalShell({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const trigger = document.activeElement as HTMLElement | null;
    d.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const b = dialog.current!.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close();
        }
      }}
    >
      <header>
        <h2 id="modal-title">{title}</h2>
        <button className="iconbtn" aria-label="Закрыть" onClick={close}>
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function Home() {
  const [planner, setPlanner] = useState<Planner>({ goals: [] }),
    [view, setView] = useState<View>("overview"),
    [year, setYear] = useState(2026),
    [week, setWeek] = useState(weekKey()),
    [modal, setModal] = useState<Modal | null>(null),
    [focusYear, setFocusYear] = useState(2026);
  const [mode, setMode] = useState<"loading" | "cloud" | "login" | "error">(
      "loading",
    ),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  const rev = useRef(0),
    lock = useRef(false);
  async function load() {
    try {
      const r = await fetch("/api/kurs/planner", { cache: "no-store" });
      if (!r.ok) {
        if (r.status === 401) {
          setPlanner({ goals: [] });
          setMode("login");
          return;
        }
        throw Error();
      }
      const d = (await r.json()) as { planner: unknown; revision: number };
      if (!validPlanner(d.planner)) throw Error();
      rev.current = d.revision;
      setPlanner(d.planner);
      setMode("cloud");
    } catch {
      setMode("error");
    }
  }
  useEffect(() => {
    setYear(Number(day().slice(0, 4)));
    const remembered = Number(localStorage.getItem("kurs.focusYear"));
    if (
      Number.isInteger(remembered) &&
      remembered >= 2000 &&
      remembered <= 2200
    ) {
      setFocusYear(remembered);
      setYear(remembered);
    } else {
      setFocusYear(Number(day().slice(0, 4)));
    }
    void load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  async function save(next: Planner) {
    if (lock.current || mode === "loading" || mode === "error") return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      {
        const r = await fetch("/api/kurs/planner", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: rev.current, planner: next }),
        });
        if (r.status === 401) {
          setMode("login");
          return false;
        }
        if (r.status === 409) {
          await load();
          setError(
            "План изменился в другом окне. Загружена свежая версия. Повтори своё изменение.",
          );
          return false;
        }
        if (!r.ok) throw Error();
        rev.current = ((await r.json()) as { revision: number }).revision;
      }
      setPlanner(next);
      return true;
    } catch {
      setError("Не удалось сохранить. Проверь соединение и повтори.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const changeGoal = (g: Goal) =>
    save({ goals: planner.goals.map((a) => (g.id === a.id ? g : a)) });
  const go = (v: View) => {
    setView(v);

    window.scrollTo(0, 0);
  };
  const goals = planner.goals.filter((g) => g.year === year),
    focus =
      goals.find((g) => g.focus) || goals.find((g) => !g.achieved) || goals[0];
  const selected = planner.goals.find((g) => g.id === modal?.id),
    currentYear = Number(day().slice(0, 4));
  const years = Array.from(
    new Set([
      currentYear - 1,
      currentYear,
      currentYear + 1,
      year,
      ...planner.goals.map((g) => g.year),
    ]),
  ).sort((a, b) => b - a);
  const chooseYear = (n: number) => {
    setYear(n);
    setWeek(n === currentYear ? weekKey() : weekKey(n + "-01-04"));
  };
  const newGoal = () => setModal({ kind: "new" }),
    open = (g: Goal) => setModal({ kind: "detail", id: g.id }),
    coach = (prompt = "", g?: Goal) => {
      setModal({ kind: "coach", id: g?.id, prompt });
    };
  const tasks = goals.flatMap((g) =>
    g.steps.filter((s) => s.week === week).map((s) => ({ g, s })),
  );
  const completed = tasks.filter((x) => x.s.done).length;
  const weekTitle =
    week === weekKey()
      ? "Эта неделя"
      : dateLabel(week, { day: "numeric", month: "short" }) +
        " – " +
        dateLabel(shiftDate(week, 6), { day: "numeric", month: "short" });
  async function carry(g: Goal) {
    if (
      planner.goals.some(
        (x) => x.year === g.year + 1 && x.lineage === g.lineage,
      )
    )
      return;
    const next = carryGoal(g, g.year + 1);
    if (await save({ goals: [...planner.goals, next] })) {
      chooseYear(next.year);
      setModal({ kind: "detail", id: next.id });
      setToast("Цель перенесена. Прошлый год сохранён.");
    }
  }
  function taskRows(compact = false) {
    return tasks.length ? (
      <div className="taskrows">
        {(compact ? tasks.slice(0, 3) : tasks).map(({ g, s }) => (
          <div key={s.id} className="taskrow">
            <button
              disabled={busy}
              role="checkbox"
              aria-label={s.title}
              aria-checked={s.done}
              className={"tick " + (s.done ? "checked" : "")}
              onClick={() =>
                changeGoal({
                  ...g,
                  steps: g.steps.map((x) =>
                    x.id === s.id ? { ...x, done: !x.done } : x,
                  ),
                })
              }
            >
              {s.done && <Check size={14} />}
            </button>
            <button className="taskinfo" onClick={() => open(g)}>
              <b className={s.done ? "done" : ""}>{s.title}</b>
              <small>
                <i className={g.category === "Обучение" ? "blue" : ""} />
                {g.title}
              </small>
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="emptymini">
        На эту неделю пока нет шагов.{" "}
        <button className="link" onClick={() => go("goals")}>
          Выбрать из целей <ArrowRight size={13} />
        </button>
      </div>
    );
  }
  const modalTitle =
    modal?.kind === "habit"
      ? "Ритм занятий"
      : modal?.kind === "new"
        ? "Новая цель"
        : modal?.kind === "edit"
          ? "Редактировать цель"
          : modal?.kind === "coach"
            ? "Помощник Катя"
            : selected?.title || "Цель";
  if (mode !== "cloud")
    return <Login mode={mode} enter={load} retry={() => void load()} />;
  return (
    <div className="journal-shell">
      <Masthead
        view={view}
        onCalendar={() => go("calendar")}
        onFocus={() => {
          chooseYear(focusYear);
          go("overview");
        }}
        onYear={() => go("goals")}
        onNew={newGoal}
      />
      <main className="journal-main">
        {error && !modal && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {view === "overview" && (
          <>
            <FocusSpread
              goal={focus}
              year={year}
              onOpen={() => focus && open(focus)}
              onCreate={newGoal}
              onCoach={() => coach("", focus)}
            >
              {focus && (
                <Today
                  g={focus}
                  busy={busy}
                  change={changeGoal}
                  open={() => open(focus)}
                  edit={() => setModal({ kind: "habit", id: focus.id })}
                  coach={(p) => coach(p, focus)}
                />
              )}
            </FocusSpread>
            {goals.length > 0 && (
              <YearStrip goals={goals} open={open} onYear={() => go("goals")} />
            )}
          </>
        )}
        {view === "calendar" && (
          <Calendar
            goals={planner.goals}
            initial={year === currentYear ? day() : year + "-01-01"}
            change={changeGoal}
            open={open}
            busy={busy}
          />
        )}
        {view === "goals" && (
          <YearSpread
            key={year}
            goals={goals}
            year={year}
            years={years}
            chooseYear={chooseYear}
            open={open}
            onCreate={newGoal}
            onCoach={() => coach()}
            onHistory={() => go("history")}
            onWeek={() => go("week")}
          />
        )}
        {(view === "history" || view === "week") && (
          <header className="spread-title">
            <h1>
              {view === "history" ? "История" : "Шаги недели"}
              <span>.</span>
            </h1>
            <button className="underlink" onClick={() => go("goals")}>
              Мой год <ArrowRight size={15} />
            </button>
          </header>
        )}
        {view === "week" && (
          <>
            <div className="sectiontitle">
              <h2>{weekTitle}</h2>
              <div className="actions">
                <button
                  className="iconbtn"
                  aria-label="Предыдущая неделя"
                  onClick={() => setWeek(shiftDate(week, -7))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="iconbtn"
                  aria-label="Следующая неделя"
                  onClick={() => setWeek(shiftDate(week, 7))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <section className="panel">
              <div className="weekline">
                {dateLabel(week, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                <span>
                  {completed} из {tasks.length} готово
                </span>
              </div>
              {taskRows()}
            </section>
            <section className="spaced">
              <h2>Добавить в план недели</h2>
              <div className="panel picklist">
                {goals
                  .filter((g) => !g.achieved)
                  .flatMap((g) =>
                    g.steps
                      .filter((s) => !s.done && s.week !== week)
                      .map((s) => (
                        <button
                          disabled={busy}
                          key={s.id}
                          onClick={() =>
                            changeGoal({
                              ...g,
                              steps: g.steps.map((t) =>
                                s.id === t.id ? { ...t, week } : t,
                              ),
                            })
                          }
                        >
                          <span>
                            {s.title}
                            <small>{g.title}</small>
                          </span>
                          <Plus size={16} />
                        </button>
                      )),
                  )}
                {!goals.some(
                  (g) =>
                    !g.achieved &&
                    g.steps.some((s) => !s.done && s.week !== week),
                ) && (
                  <p className="muted">
                    Все открытые шаги уже в плане. Новый шаг можно добавить в
                    карточке цели.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
        {view === "history" && (
          <>
            <p className="historyintro">
              Результаты каждого года и цели, которые ты продолжаешь.
            </p>
            {Array.from(new Set([...planner.goals.map((g) => g.year), year]))
              .sort((a, b) => b - a)
              .map((y) => {
                const batch = planner.goals.filter((g) => g.year === y);
                return (
                  <section key={y} className="historyblock">
                    <div className="sectiontitle">
                      <h2>{y}</h2>
                      <span className="micro">
                        {batch.length}{" "}
                        {word(batch.length, "цель", "цели", "целей")} ·
                        Достигнуто {batch.filter((g) => g.achieved).length}
                      </span>
                    </div>
                    <div className="panel">
                      {batch.length ? (
                        batch.map((g) => (
                          <div className="histrow" key={g.id}>
                            <button
                              className="taskinfo"
                              onClick={() => open(g)}
                            >
                              <b>{g.title}</b>
                              <small>
                                {g.achieved ? "Достигнута" : "В работе"} ·{" "}
                                {g.entries.at(-1)?.value ||
                                  g.baseline ||
                                  "Результат пока не записан"}
                                {planner.goals.some(
                                  (x) =>
                                    x.lineage === g.lineage && x.year === y - 1,
                                )
                                  ? " · Продолжена с " + (y - 1)
                                  : ""}
                              </small>
                            </button>
                            {!g.achieved &&
                              !planner.goals.some(
                                (x) =>
                                  x.lineage === g.lineage && x.year === y + 1,
                              ) && (
                                <button
                                  className="secondary small"
                                  disabled={busy}
                                  onClick={() => carry(g)}
                                >
                                  В {y + 1} <ArrowRight size={14} />
                                </button>
                              )}
                          </div>
                        ))
                      ) : (
                        <div className="emptymini">
                          Целей за этот год пока нет.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
          </>
        )}
        <footer className="journal-footer">
          <button
            className="underlink"
            onClick={async () => {
              try {
                const r = await fetch("/api/kurs/logout", { method: "POST" });
                if (!r.ok) throw Error();
                setModal(null);
                setPlanner({ goals: [] });
                setMode("login");
              } catch {
                setError("Не удалось выйти. Проверь соединение.");
              }
            }}
          >
            Выйти из журнала
          </button>
        </footer>
      </main>
      {modal && (
        <ModalShell
          key={modal.kind + (modal.id || "")}
          title={modalTitle}
          close={() => {
            if (!busy) {
              setModal(null);
              setError("");
            }
          }}
        >
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {modal.kind === "habit" && selected && (
            <HabitForm
              g={selected}
              draft={modal.proposal}
              busy={busy}
              onSave={async (g) => {
                const ok = await changeGoal(g);
                if (ok) {
                  setModal(null);
                  setToast("Ритм сохранён");
                }
                return ok;
              }}
            />
          )}
          {modal.kind === "detail" && selected && (
            <>
              <button
                className="underlink"
                onClick={() => setModal({ kind: "habit", id: selected.id })}
              >
                <CalendarDays size={15} />
                Настроить ритм занятий
              </button>
              <Detail
                key={selected.id}
                g={selected}
                busy={busy}
                hasNext={planner.goals.some(
                  (x) =>
                    x.year === selected.year + 1 &&
                    x.lineage === selected.lineage,
                )}
                onChange={changeGoal}
                onAI={() =>
                  coach("Помоги выбрать следующий шаг для этой цели.", selected)
                }
                onEdit={() => setModal({ kind: "edit", id: selected.id })}
                onCarry={() => carry(selected)}
                onFocus={async () => {
                  if (
                    await save({
                      goals: planner.goals.map((g) =>
                        g.year === selected.year
                          ? { ...g, focus: g.id === selected.id }
                          : g,
                      ),
                    })
                  ) {
                    chooseYear(selected.year);
                    setFocusYear(selected.year);
                    localStorage.setItem(
                      "kurs.focusYear",
                      String(selected.year),
                    );
                    go("overview");
                    setModal(null);
                    setToast("Цель в фокусе");
                  }
                }}
                onDelete={async () => {
                  if (
                    await save({
                      goals: planner.goals.filter((g) => g.id !== selected.id),
                    })
                  ) {
                    setModal(null);
                    setToast("Цель удалена");
                  }
                }}
              />
            </>
          )}
          {modal.kind === "new" && !modal.draft && (
            <button
              className="aistart"
              onClick={() =>
                coach(
                  "Хочу придумать новую цель. Задай мне один вопрос, чтобы помочь её сформулировать.",
                )
              }
            >
              <Sparkles size={16} /> Придумать вместе с Катей{" "}
              <ArrowRight size={14} />
            </button>
          )}
          {(modal.kind === "edit" || modal.kind === "new") && (
            <Editor
              year={selected?.year || year}
              existing={modal.kind === "edit" ? selected : undefined}
              draft={modal.draft}
              busy={busy}
              onSave={async (g) => {
                if (modal.proposal) {
                  const { cue, action, minimum, minutes, days } =
                    modal.proposal;
                  g = putHabit(g, {
                    cue,
                    action,
                    minimum,
                    minutes,
                    days,
                    since: startFor(g),
                  });
                }
                const ok = selected
                  ? await changeGoal(g)
                  : await save({ goals: [...planner.goals, g] });
                if (ok) {
                  open(g);
                  setToast("Цель сохранена");
                }
              }}
            />
          )}
          {modal.kind === "coach" && (
            <Coach
              goal={selected}
              initial={modal.prompt || ""}
              onApply={(proposal) =>
                selected
                  ? setModal({ kind: "habit", id: selected.id, proposal })
                  : setModal({ kind: "new", draft: proposal, proposal })
              }
            />
          )}
        </ModalShell>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
