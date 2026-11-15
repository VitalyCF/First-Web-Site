"use client";
import { useState } from "react";
import {
  categories,
  day,
  weekKey,
  uid,
  type Goal,
  type Category,
} from "../planner";
export type Draft = { title: string; target: string; steps: string[] };
export function Editor({
  existing,
  draft,
  year,
  busy,
  onSave,
}: {
  existing?: Goal;
  draft?: Draft;
  year: number;
  busy: boolean;
  onSave: (g: Goal) => void;
}) {
  const [title, setTitle] = useState(draft?.title || existing?.title || "");
  const [target, setTarget] = useState(draft?.target || existing?.target || "");
  const [baseline, setBase] = useState(existing?.baseline || "");
  const [category, setCat] = useState<Category>(existing?.category || "Личное");
  const [lines, setLines] = useState(draft?.steps.join("\n") || "");
  const [thisWeek, setWeek] = useState(true);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const id = existing?.id || uid();
        const additions = lines
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 30)
          .map((t, i) => ({
            id: uid(),
            title: t.slice(0, 300),
            done: false,
            week:
              i === 0 && thisWeek && year === Number(day().slice(0, 4))
                ? weekKey()
                : "",
          }));
        const steps = [...(existing?.steps || []), ...additions];
        onSave({
          ...existing,
          id,
          lineage: existing?.lineage || id,
          year,
          title: title.trim(),
          target: target.trim(),
          baseline: baseline.trim(),
          category,
          steps,
          entries: existing?.entries || [],
          achieved: existing?.achieved || false,
          focus: existing?.focus || false,
        });
      }}
    >
      <label>
        Чего хочешь достичь?
        <input
          required
          autoFocus
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, сыграть три песни на пианино"
        />
      </label>
      <label>
        Как поймёшь, что получилось?
        <input
          maxLength={400}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Измеримый результат или событие"
        />
      </label>
      <div className="formpair">
        <label>
          Сфера
          <select
            value={category}
            onChange={(e) => setCat(e.target.value as Category)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Отправная точка
          <input
            maxLength={400}
            value={baseline}
            onChange={(e) => setBase(e.target.value)}
            placeholder="Где ты сейчас?"
          />
        </label>
      </div>
      {(!existing || draft) && (
        <>
          <label>
            {existing ? "Добавить шаги" : "Шаги"}{" "}
            <small>По одному на строку</small>
            <textarea
              value={lines}
              maxLength={6500}
              onChange={(e) => setLines(e.target.value)}
              rows={4}
              placeholder="Что можно сделать первым?"
            />
          </label>
          {year === Number(day().slice(0, 4)) && (
            <label className="checklabel">
              <input
                type="checkbox"
                checked={thisWeek}
                onChange={(e) => setWeek(e.target.checked)}
              />
              Взять первый шаг на эту неделю
            </label>
          )}
        </>
      )}
      <button className="primary full" disabled={busy || !title.trim()}>
        {existing ? "Сохранить изменения" : "Сохранить цель"}
      </button>
    </form>
  );
}
