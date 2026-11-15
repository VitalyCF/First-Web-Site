export const categories = [
  "Sport",
  "Learning",
  "Career",
  "Personal",
  "Hobbies",
  "Family",
  "Health",
  "Travel",
  "Finance",
  "Spirituality",
] as const;
const legacyAreas: Record<string, string> = {
  Спорт: "Sport",
  Обучение: "Learning",
  Работа: "Career",
  Личное: "Personal",
  Хобби: "Hobbies",
  Семья: "Family",
  Здоровье: "Health",
  Отдых: "Travel",
  Финансы: "Finance",
  Духовность: "Spirituality",
};
export const areaName = (s: string) => legacyAreas[s] || s;
export const strategies = [
  "project",
  "habit",
  "milestone",
  "exploration",
] as const;
export type Strategy = (typeof strategies)[number];
export const strategyName = (s?: string) =>
  ({
    project: "Project",
    habit: "Practice",
    milestone: "Milestone",
    exploration: "Exploration",
  })[s || "project"] || "Project";
export type Category = (typeof categories)[number];
export type Step = {
  id: string;
  title: string;
  done: boolean;
  week: string;
  date?: string;
  time?: string;
  minutes?: number;
  milestone?: string;
};
export type Entry = { date: string; value: string };
export type Habit = {
  until?: string;
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
  strategy?: Strategy;
  why?: string;
  resources?: string;
  deadline?: string;
  status?: "active" | "paused" | "changed" | "released";
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
export type YearReport = {
  headline: string;
  summary: string;
  planned: { goalId: string; outcome: string; evidence: string }[];
  unexpected: string[];
  lessons: string[];
  nextYear: string[];
  questions: string[];
};
export type YearReview = {
  year: number;
  notes: string;
  wins: { id: string; title: string; area: string }[];
  ratings: { area: string; score: number }[];
  report?: YearReport;
  generatedAt?: string;
};
export type Planner = { goals: Goal[]; reviews?: YearReview[] };
export type SourceNote = {
  id: string;
  title: string;
  year: number | null;
  text: string;
  revision: number;
  hasImage: boolean;
  createdAt: string;
};
export const reviewFor = (p: Planner, year: number): YearReview =>
  p.reviews?.find((r) => r.year === year) || {
    year,
    notes: "",
    wins: [],
    ratings: [],
  };
export function withReview(p: Planner, r: YearReview): Planner {
  return {
    ...p,
    reviews: [...(p.reviews ?? []).filter((x) => x.year !== r.year), r],
  };
}
export function normalizePlanner(p: Planner): Planner {
  return {
    ...p,
    goals: p.goals.map((g) => ({
      ...g,
      category: areaName(g.category) as Category,
    })),
  };
}
export function reportOK(r: YearReport) {
  return (
    !!r &&
    typeof r.headline === "string" &&
    r.headline.length <= 300 &&
    typeof r.summary === "string" &&
    r.summary.length <= 6000 &&
    Array.isArray(r.planned) &&
    r.planned.length <= 100 &&
    r.planned.every(
      (x) =>
        x &&
        (["goalId", "outcome", "evidence"] as const).every(
          (k) => typeof x[k] === "string" && x[k].length <= 1200,
        ),
    ) &&
    (["unexpected", "lessons", "nextYear", "questions"] as const).every(
      (k) =>
        Array.isArray(r[k]) &&
        r[k].length <= 20 &&
        r[k].every((x) => typeof x === "string" && x.length <= 1500),
    )
  );
}
function reviewsOK(p: Planner) {
  return (
    p.reviews === undefined ||
    (Array.isArray(p.reviews) &&
      p.reviews.length <= 201 &&
      new Set(p.reviews.map((r) => r?.year)).size === p.reviews.length &&
      p.reviews.every(
        (r) =>
          r &&
          Number.isInteger(r.year) &&
          r.year >= 2000 &&
          r.year <= 2200 &&
          typeof r.notes === "string" &&
          r.notes.length <= 20000 &&
          Array.isArray(r.wins) &&
          r.wins.length <= 200 &&
          new Set(r.wins.map((w) => w?.id)).size === r.wins.length &&
          r.wins.every(
            (w) =>
              w &&
              typeof w.id === "string" &&
              w.id.length <= 100 &&
              typeof w.title === "string" &&
              w.title.length <= 1000 &&
              typeof w.area === "string" &&
              w.area.length <= 40,
          ) &&
          Array.isArray(r.ratings) &&
          r.ratings.length <= 10 &&
          new Set(r.ratings.map((x) => x?.area)).size === r.ratings.length &&
          r.ratings.every(
            (x) =>
              x &&
              categories.includes(x.area as Category) &&
              Number.isInteger(x.score) &&
              x.score >= 1 &&
              x.score <= 10,
          ) &&
          (!r.report || reportOK(r.report)),
      ))
  );
}

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
    habits:
      g.habits?.length && !g.habits.at(-1)?.until
        ? [{ ...g.habits[g.habits.length - 1], since: year + "-01-01" }]
        : [],
    practice: [],
    id: uid(),
    year,
    baseline: currentValue(g),
    deadline: "",
    status: "active",
    entries: [],
    focus: false,
    achieved: false,
    steps: g.steps
      .filter((s) => !s.done)
      .map((s) => ({ ...s, id: uid(), week: "", date: "", time: "" })),
  };
}
export function validPlanner(x: unknown): x is Planner {
  const obj = x as Planner;
  const str = (s: unknown, n: number) => typeof s === "string" && s.length <= n;
  const date = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s));
  if (
    !obj ||
    !reviewsOK(obj) ||
    !Array.isArray(obj.goals) ||
    obj.goals.length > 1200
  )
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
      (!g.strategy || strategies.includes(g.strategy)) &&
      [g.why, g.resources].every((v) => v === undefined || str(v, 3000)) &&
      (!g.deadline ||
        (dateOK(g.deadline) && g.deadline.startsWith(g.year + "-"))) &&
      (!g.status ||
        ["active", "paused", "changed", "released"].includes(g.status)) &&
      Number.isInteger(g.year) &&
      g.year >= 2000 &&
      g.year <= 2200 &&
      str(g.title, 200) &&
      !!g.title.trim() &&
      categories.includes(areaName(g.category) as Category) &&
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
          (s.week === "" || date(s.week)) &&
          (!s.date || (dateOK(s.date) && s.date.startsWith(g.year + "-"))) &&
          (!s.time || /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) &&
          (s.minutes === undefined ||
            (Number.isInteger(s.minutes) &&
              s.minutes >= 0 &&
              s.minutes <= 1440)) &&
          (!s.milestone || str(s.milestone, 300)),
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
    (h.until === undefined || (dateOK(h.until) && h.until >= h.since)) &&
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
  const h = (g.habits ?? []).filter((h) => h.since <= date).at(-1);
  return h && (!h.until || date < h.until) ? h : undefined;
}
export function planned(g: Goal, date: string) {
  return !!habitAt(g, date)?.days.includes(
    new Date(date + "T12:00:00Z").getUTCDay(),
  );
}
export function stopHabit(g: Goal, since = day()): Goal {
  return {
    ...g,
    habits: (g.habits ?? []).map((h) =>
      !h.until || h.until > since
        ? { ...h, until: h.since > since ? h.since : since }
        : h,
    ),
  };
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
