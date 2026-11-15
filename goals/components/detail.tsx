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
            Достигнута
          </span>
        )}
        <button
          className="iconbtn end"
          onClick={onEdit}
          title="Редактировать цель"
        >
          <Pencil size={17} />
        </button>
      </div>
      <div className="metrics">
        <div>
          <small>Текущий результат</small>
          <b>{currentValue(g) || "Пока нет записи"}</b>
        </div>
        <ArrowRight size={16} />
        <div>
          <small>Цель</small>
          <b>{g.target || "Можно задать критерий"}</b>
        </div>
      </div>
      <div className="headingrow">
        <h3>План действий</h3>
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
                  aria-label="Название шага"
                  autoFocus
                  value={renamed}
                  onChange={(e) => rename(e.target.value)}
                />
                <button
                  disabled={busy}
                  className="iconbtn"
                  aria-label="Сохранить шаг"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Удалить шаг"
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
                  title="Редактировать шаг"
                  onClick={() => {
                    setEditStep(s.id);
                    rename(s.title);
                  }}
                >
                  {s.title}
                  {s.week && (
                    <small>
                      Неделя с{" "}
                      {new Date(s.week + "T12:00:00").toLocaleDateString("ru", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </small>
                  )}
                </button>
                <button
                  className={"iconbtn " + (s.week === weekKey() ? "on" : "")}
                  disabled={busy || g.year !== Number(day().slice(0, 4))}
                  title={
                    s.week === weekKey()
                      ? "Убрать с этой недели"
                      : "Взять на эту неделю"
                  }
                  aria-label={
                    s.week === weekKey()
                      ? "Убрать с этой недели"
                      : "Взять на эту неделю"
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
          aria-label="Новый шаг"
          value={step}
          onChange={(e) => setStep(e.target.value)}
          placeholder="Добавить небольшой шаг"
        />
        <button
          className="secondary"
          disabled={busy || !step.trim()}
          aria-label="Добавить шаг"
        >
          <Plus size={17} />
        </button>
      </form>
      <section>
        <h3>Дневник результата</h3>
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
              aria-label="Дата результата"
              value={when}
              min={g.year + "-01-01"}
              max={g.year + "-12-31"}
              onChange={(e) => setWhen(e.target.value)}
            />
            <input
              maxLength={400}
              aria-label="Результат"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Что изменилось?"
            />
          </div>
          <button className="secondary" disabled={busy || !value.trim()}>
            Записать результат
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
          {g.achieved ? "Вернуть в работу" : "Отметить достигнутой"}
        </button>
        <button
          className="secondary"
          disabled={busy || g.focus}
          onClick={onFocus}
        >
          <Star size={16} />
          {g.focus ? "В фокусе" : "Поставить в фокус"}
        </button>
        <button className="secondary" onClick={onAI}>
          <Sparkles size={16} />
          Обсудить с Катей
        </button>
        <button
          className="secondary"
          disabled={busy || hasNext}
          onClick={onCarry}
        >
          <Flag size={16} />
          {hasNext
            ? "Уже есть в " + (g.year + 1)
            : "Продолжить в " + (g.year + 1)}
        </button>
      </div>
      {deleting ? (
        <div className="notice">
          <p>Удалить цель за {g.year} год со всеми шагами и записями?</p>
          <button className="danger" disabled={busy} onClick={onDelete}>
            Удалить
          </button>{" "}
          <button className="link" onClick={() => del(false)}>
            Отмена
          </button>
        </div>
      ) : (
        <button className="link muted" onClick={() => del(true)}>
          Удалить цель за этот год
        </button>
      )}
    </div>
  );
}
