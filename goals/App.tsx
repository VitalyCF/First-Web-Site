import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Sparkles, X, CalendarDays } from "lucide-react";
import {
  day,
  carryGoal,
  normalizePlanner,
  validPlanner,
  type Goal,
  type Planner,
} from "./planner";
import { api, RequestError } from "./api";
import {
  Masthead,
  FocusSpread,
  YearSpread,
  YearStrip,
} from "./components/journal";
import { Calendar, Today, HabitForm } from "./components/practice";
import { Editor } from "./components/goal-editor";
import { Detail } from "./components/detail";
import { Coach, type ChatContext } from "./components/coach";
import { Review } from "./components/review";
import { Login } from "./components/login";
type View = "focus" | "year" | "calendar" | "review" | "assistant";
type Modal = { kind: "detail" | "edit" | "new" | "habit"; id?: string };
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
    const d = dialog.current,
      trigger = document.activeElement as HTMLElement;
    d?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={dialog}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id="modal-title">{title}</h2>
        <button className="iconbtn" aria-label="Close" onClick={close}>
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function Home() {
  const currentYear = Number(day().slice(0, 4));
  const [planner, setPlanner] = useState<Planner>({ goals: [] }),
    [revision, setRevision] = useState(0),
    [mode, setMode] = useState<"loading" | "cloud" | "login" | "error">(
      "loading",
    ),
    [year, setYear] = useState(currentYear),
    [view, setView] = useState<View>("focus"),
    [modal, setModal] = useState<Modal | null>(null),
    [context, setContext] = useState<ChatContext>({
      id: crypto.randomUUID(),
      year: currentYear,
      goalId: "",
      mode: "goal",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const guard = useRef(false);
  function adopt(d: { planner: Planner; revision: number }) {
    if (!validPlanner(d.planner))
      throw Error("The journal response could not be read.");
    setPlanner(normalizePlanner(d.planner));
    setRevision(d.revision);
  }
  async function load() {
    try {
      adopt(await api("planner", { cache: "no-store" }));
      setMode("cloud");
    } catch (e) {
      setMode(
        e instanceof RequestError && e.status === 401 ? "login" : "error",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function save(next: Planner) {
    if (guard.current) return false;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await api("planner", {
        method: "PUT",
        body: JSON.stringify({ revision, planner: next }),
      });
      adopt({ planner: next, revision: r.revision });
      return true;
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) setMode("login");
      if (e instanceof RequestError && e.status === 409) await load();
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  const change = (g: Goal) =>
    save({
      ...planner,
      goals: planner.goals.map((x) => (x.id === g.id ? g : x)),
    });
  function go(v: string) {
    setView(v as View);
    setError("");
    window.scrollTo(0, 0);
  }
  const selected = planner.goals.find((g) => g.id === modal?.id),
    goals = planner.goals.filter((g) => g.year === year),
    focus =
      goals.find((g) => g.focus) ||
      goals.find((g) => !g.achieved && (!g.status || g.status === "active")) ||
      goals[0];
  const years = [
    ...new Set([
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      ...planner.goals.map((g) => g.year),
      ...(planner.reviews ?? []).map((r) => r.year),
    ]),
  ].sort((a, b) => b - a);
  const open = (g: Goal) => setModal({ kind: "detail", id: g.id });
  function chat(prompt = "", g?: Goal, review = false) {
    setContext({
      id: crypto.randomUUID(),
      year: g?.year || year,
      goalId: g?.id || "",
      mode: review ? "review" : "goal",
      prompt,
    });
    setModal(null);
    go("assistant");
  }
  async function carry(g: Goal) {
    if (
      planner.goals.some(
        (x) => x.lineage === g.lineage && x.year === g.year + 1,
      )
    )
      return;
    const next = carryGoal(g, g.year + 1);
    if (await save({ ...planner, goals: [...planner.goals, next] })) {
      setYear(next.year);
      open(next);
      setToast("Goal continued in " + next.year);
    }
  }
  if (mode !== "cloud")
    return <Login mode={mode} enter={load} retry={() => void load()} />;
  return (
    <div className="journal-shell">
      <Masthead view={view} go={go} onNew={() => chat()} />
      <main className="journal-main">
        {error && !modal && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {view === "focus" && (
          <>
            <FocusSpread
              goal={focus}
              year={year}
              onOpen={() => focus && open(focus)}
              onCreate={() => chat()}
            >
              {focus && (
                <Today
                  g={focus}
                  busy={busy}
                  change={change}
                  edit={() => setModal({ kind: "habit", id: focus.id })}
                  open={() => open(focus)}
                  coach={(p) => chat(p, focus)}
                />
              )}
            </FocusSpread>
            {goals.length > 0 && (
              <YearStrip goals={goals} open={open} onYear={() => go("year")} />
            )}
          </>
        )}
        {view === "year" && (
          <YearSpread
            key={year}
            goals={goals}
            year={year}
            years={years}
            chooseYear={setYear}
            open={open}
            onCreate={() => chat()}
            onReview={() => go("review")}
          />
        )}
        {view === "calendar" && (
          <Calendar
            key={year}
            goals={planner.goals}
            initial={year === currentYear ? day() : year + "-01-01"}
            change={change}
            open={open}
            busy={busy}
          />
        )}
        {view === "review" && (
          <Review
            key={year}
            planner={planner}
            year={year}
            years={years}
            chooseYear={setYear}
            save={save}
            busy={busy}
            open={open}
            chat={(p) => chat(p, undefined, true)}
          />
        )}
        {view === "assistant" && (
          <Coach
            key={context.id}
            initial={context}
            planner={planner}
            revision={revision}
            adopt={adopt}
            reload={load}
            onManual={() => setModal({ kind: "new" })}
            onBack={() => go(context.mode === "review" ? "review" : "focus")}
          />
        )}
        <footer className="journal-footer">
          <button
            className="underlink"
            onClick={async () => {
              try {
                await api("logout", { method: "POST" });
                setPlanner({ goals: [] });
                setMode("login");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        </footer>
      </main>
      {modal && (
        <ModalShell
          title={
            modal.kind === "new"
              ? "Write a goal"
              : modal.kind === "edit"
                ? "Edit goal"
                : modal.kind === "habit"
                  ? "Your routine"
                  : selected?.title || "Goal"
          }
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
          {modal.kind === "detail" && selected && (
            <>
              <div className="goal-tools">
                <button
                  className="underlink"
                  onClick={() => setModal({ kind: "habit", id: selected.id })}
                >
                  <CalendarDays size={15} />
                  Routine settings
                </button>
                <label>
                  Status
                  <select
                    aria-label="Goal status"
                    value={selected.status || "active"}
                    disabled={busy}
                    onChange={(e) =>
                      void change({
                        ...selected,
                        status: e.target.value as Goal["status"],
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="changed">Changed direction</option>
                    <option value="released">Consciously released</option>
                  </select>
                </label>
              </div>
              {selected.why && <p className="goal-why">{selected.why}</p>}
              <Detail
                g={selected}
                busy={busy}
                hasNext={planner.goals.some(
                  (x) =>
                    x.lineage === selected.lineage &&
                    x.year === selected.year + 1,
                )}
                onChange={change}
                onAI={() => chat("", selected)}
                onEdit={() => setModal({ kind: "edit", id: selected.id })}
                onCarry={() => void carry(selected)}
                onFocus={async () => {
                  if (
                    await save({
                      ...planner,
                      goals: planner.goals.map((g) =>
                        g.year === selected.year
                          ? { ...g, focus: g.id === selected.id }
                          : g,
                      ),
                    })
                  ) {
                    setYear(selected.year);
                    setModal(null);
                    go("focus");
                  }
                }}
                onDelete={async () => {
                  if (
                    await save({
                      ...planner,
                      goals: planner.goals.filter((g) => g.id !== selected.id),
                    })
                  ) {
                    setModal(null);
                    setToast("Goal deleted");
                  }
                }}
              />
            </>
          )}
          {(modal.kind === "edit" || modal.kind === "new") && (
            <Editor
              existing={modal.kind === "edit" ? selected : undefined}
              year={selected?.year || year}
              busy={busy}
              onSave={async (g) => {
                const ok = selected
                  ? await change(g)
                  : await save({ ...planner, goals: [...planner.goals, g] });
                if (ok) {
                  open(g);
                  setToast("Goal saved");
                }
              }}
            />
          )}
          {modal.kind === "habit" && selected && (
            <HabitForm
              g={selected}
              busy={busy}
              onSave={async (g) => {
                const ok = await change(g);
                if (ok) {
                  setModal(null);
                  setToast("Routine saved");
                }
                return ok;
              }}
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
