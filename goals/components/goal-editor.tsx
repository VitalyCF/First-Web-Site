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
  const [category, setCat] = useState<Category>(
    existing?.category || "Personal",
  );
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
        What would you like to achieve?
        <input
          required
          autoFocus
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="For example, play three songs on the piano"
        />
      </label>
      <label>
        What does success look like?
        <input
          maxLength={400}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="A measurable outcome or event"
        />
      </label>
      <div className="formpair">
        <label>
          Life area
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
          Starting point
          <input
            maxLength={400}
            value={baseline}
            onChange={(e) => setBase(e.target.value)}
            placeholder="Where are you now?"
          />
        </label>
      </div>
      {(!existing || draft) && (
        <>
          <label>
            {existing ? "Add steps" : "Steps"} <small>One per line</small>
            <textarea
              value={lines}
              maxLength={6500}
              onChange={(e) => setLines(e.target.value)}
              rows={4}
              placeholder="What could you do first?"
            />
          </label>
          {year === Number(day().slice(0, 4)) && (
            <label className="checklabel">
              <input
                type="checkbox"
                checked={thisWeek}
                onChange={(e) => setWeek(e.target.checked)}
              />
              Add the first step to this week
            </label>
          )}
        </>
      )}
      <button className="primary full" disabled={busy || !title.trim()}>
        {existing ? "Save changes" : "Save goal"}
      </button>
    </form>
  );
}
