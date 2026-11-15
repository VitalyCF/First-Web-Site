export const categories = [
  "Спорт",
  "Обучение",
  "Работа",
  "Личное",
  "Хобби",
  "Семья",
  "Здоровье",
  "Отдых",
  "Финансы",
  "Духовность",
] as const;
export type Category = (typeof categories)[number];
export type Step = { id: string; title: string; done: boolean; week: string };
export type Entry = { date: string; value: string };
export type Habit = {
  since: string;
  cue: string;
  action: string;
  minimum: string;
  minutes: number;
  days: number[];
};
export type Practice = {
  date: string;
  action: string;
  kind: "full" | "minimum";
};
export type Goal = {
  habits?: Habit[];
  practice?: Practice[];
  id: string;
  lineage: string;
  year: number;
  title: string;
  category: Category;
  target: string;
  baseline: string;
  steps: Step[];
  entries: Entry[];
  achieved: boolean;
  focus: boolean;
};
export type Planner = { goals: Goal[] };
export const uid = () => crypto.randomUUID();
export const day = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function weekKey(date = day()) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const finished = (g: Goal) => g.steps.filter((s) => s.done).length;
export const percent = (g: Goal) =>
  g.steps.length ? Math.round((100 * finished(g)) / g.steps.length) : 0;
export const currentValue = (g: Goal) => g.entries.at(-1)?.value || g.baseline;
export function carryGoal(g: Goal, year: number): Goal {
  return {
    ...g,
    habits: g.habits?.length
      ? [{ ...g.habits[g.habits.length - 1], since: year + "-01-01" }]
      : [],
    practice: [],
    id: uid(),
    year,
    baseline: currentValue(g),
    entries: [],
    focus: false,
    achieved: false,
    steps: g.steps
      .filter((s) => !s.done)
      .map((s) => ({ ...s, id: uid(), week: "" })),
  };
}
export function validPlanner(x: unknown): x is Planner {
  const obj = x as Planner;
  const str = (s: unknown, n: number) => typeof s === "string" && s.length <= n;
  const date = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s));
  if (!obj || !Array.isArray(obj.goals) || obj.goals.length > 1200)
    return false;
  const ids = new Set(),
    years = new Set();
  return obj.goals.every((g) => {
    if (
      !g ||
      !str(g.id, 100) ||
      !g.id ||
      ids.has(g.id) ||
      !str(g.lineage, 100) ||
      !g.lineage ||
      years.has(g.lineage + ":" + g.year)
    )
      return false;
    ids.add(g.id);
    years.add(g.lineage + ":" + g.year);
    return (
      validHabits(g) &&
      Number.isInteger(g.year) &&
      g.year >= 2000 &&
      g.year <= 2200 &&
      str(g.title, 200) &&
      !!g.title.trim() &&
      categories.includes(g.category) &&
      str(g.baseline, 400) &&
      str(g.target, 400) &&
      typeof g.focus === "boolean" &&
      typeof g.achieved === "boolean" &&
      Array.isArray(g.steps) &&
      g.steps.length <= 200 &&
      new Set(g.steps.map((s) => s?.id)).size === g.steps.length &&
      g.steps.every(
        (s) =>
          s &&
          str(s.id, 100) &&
          s.id &&
          str(s.title, 300) &&
          s.title.trim() &&
          typeof s.done === "boolean" &&
          (s.week === "" || date(s.week)),
      ) &&
      Array.isArray(g.entries) &&
      g.entries.length <= 1500 &&
      g.entries.every(
        (e) => e && date(e.date) && str(e.value, 400) && e.value.trim(),
      )
    );
  });
}

export function dateOK(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function validHabit(h: Habit): boolean {
  return (
    !!h &&
    dateOK(h.since) &&
    [h.action, h.minimum, h.cue].every(
      (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 300,
    ) &&
    Number.isInteger(h.minutes) &&
    h.minutes >= 1 &&
    h.minutes <= 180 &&
    Array.isArray(h.days) &&
    h.days.length > 0 &&
    h.days.length <= 7 &&
    new Set(h.days).size === h.days.length &&
    h.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
}
function validHabits(g: Goal) {
  const habits = g.habits ?? [],
    practice = g.practice ?? [];
  return (
    Array.isArray(habits) &&
    habits.length <= 366 &&
    habits.every(
      (h, i) =>
        validHabit(h) &&
        h.since.startsWith(g.year + "-") &&
        (!i || habits[i - 1].since < h.since),
    ) &&
    Array.isArray(practice) &&
    practice.length <= 366 &&
    new Set(practice.map((p) => p?.date)).size === practice.length &&
    practice.every(
      (p) =>
        p &&
        dateOK(p.date) &&
        p.date.startsWith(g.year + "-") &&
        typeof p.action === "string" &&
        p.action.length > 0 &&
        p.action.length <= 300 &&
        ["full", "minimum"].includes(p.kind),
    )
  );
}
export function habitAt(g: Goal, date: string) {
  return (g.habits ?? []).filter((h) => h.since <= date).at(-1);
}
export function planned(g: Goal, date: string) {
  return !!habitAt(g, date)?.days.includes(
    new Date(date + "T12:00:00Z").getUTCDay(),
  );
}
export function putHabit(g: Goal, h: Habit): Goal {
  return {
    ...g,
    habits: [...(g.habits ?? []).filter((x) => x.since !== h.since), h].sort(
      (a, b) => a.since.localeCompare(b.since),
    ),
  };
}
export function checkPractice(
  g: Goal,
  date: string,
  kind: Practice["kind"] | "undo",
): Goal {
  const previous = (g.practice ?? []).filter((p) => p.date !== date);
  if (kind === "undo") return { ...g, practice: previous };
  const h = habitAt(g, date);
  if (!h || date > day() || !date.startsWith(g.year + "-")) return g;
  return {
    ...g,
    practice: [
      ...previous,
      { date, action: kind === "minimum" ? h.minimum : h.action, kind },
    ].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
