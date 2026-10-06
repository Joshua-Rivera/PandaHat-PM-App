"use client";

import { useState } from "react";

import type { Availability, AvailabilityBlock } from "@/lib/api/types";
import { formatHours, WEEKDAYS } from "@/lib/format";
import { useReplaceAvailability } from "@/lib/queries";

import { FormError, serverErrors } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

import { hhmm } from "./AvailabilitySummary";

type Draft = { key: number; weekday: number; start: string; end: string };

let nextKey = 1;
const toDraft = (b: AvailabilityBlock): Draft => ({ key: nextKey++, weekday: b.weekday, start: hhmm(b.start_time), end: hhmm(b.end_time) });

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function problems(blocks: Draft[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const block of blocks) {
    if (!block.start || !block.end) errors[block.key] = "Enter a start and end time.";
    else if (minutes(block.end) <= minutes(block.start)) errors[block.key] = "End time must be after the start time.";
  }
  for (let day = 0; day < 7; day++) {
    const sorted = blocks.filter((b) => b.weekday === day && !errors[b.key]).sort((a, b) => minutes(a.start) - minutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (minutes(sorted[i].start) < minutes(sorted[i - 1].end)) errors[sorted[i].key] = "Overlaps another block on this day.";
    }
  }
  return errors;
}

export function AvailabilityEditor({ initial }: { initial: Availability }) {
  const [blocks, setBlocks] = useState<Draft[]>(() => initial.blocks.map(toDraft));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial.blocks.map(toDraft).map(({ key: _k, ...b }) => b)));
  const replace = useReplaceAvailability();
  const toast = useToast();

  const errors = problems(blocks);
  const hasErrors = Object.keys(errors).length > 0;
  const weeklyHours = blocks.filter((b) => !errors[b.key]).reduce((sum, b) => sum + (minutes(b.end) - minutes(b.start)) / 60, 0);
  const dirty = JSON.stringify(blocks.map(({ key: _k, ...b }) => b)) !== savedSnapshot;

  const update = (key: number, patch: Partial<Draft>) => setBlocks((all) => all.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const add = (weekday: number) => {
    const sameDay = blocks.filter((b) => b.weekday === weekday);
    const lastEnd = sameDay.length ? sameDay.map((b) => b.end).sort().at(-1)! : "15:00";
    const startMin = Math.min(minutes(lastEnd), 21 * 60);
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    setBlocks((all) => [...all, { key: nextKey++, weekday, start: fmt(startMin), end: fmt(Math.min(startMin + 180, 23 * 60 + 59)) }]);
  };
  const remove = (key: number) => setBlocks((all) => all.filter((b) => b.key !== key));

  const save = () => {
    const payload = blocks.map((b) => ({ weekday: b.weekday, start_time: b.start, end_time: b.end }));
    replace.mutate(payload, {
      onSuccess: (saved) => {
        setSavedSnapshot(JSON.stringify(blocks.map(({ key: _k, ...b }) => b)));
        toast.success(`Availability saved: ${formatHours(saved.weekly_capacity_hours)} per week`);
      },
    });
  };

  return (
    <div className="stack-lg">
      <div className="availability-grid">
        {WEEKDAYS.map((day, weekday) => {
          const dayBlocks = blocks.filter((b) => b.weekday === weekday);
          return (
            <section key={day} className="card availability-day" aria-label={day}>
              <header className="row space-between">
                <h3>{day}</h3>
                <button type="button" className="link-btn" onClick={() => add(weekday)}>
                  <Icon name="plus" size={12} /> Add time block
                </button>
              </header>
              {dayBlocks.length === 0 ? <p className="muted small">Unavailable</p> : null}
              {dayBlocks.map((block) => (
                <div key={block.key} className="stack-xs">
                  <div className="time-block">
                    <input
                      type="time"
                      value={block.start}
                      onChange={(e) => update(block.key, { start: e.target.value })}
                      aria-label={`${day} start time`}
                      aria-invalid={!!errors[block.key] || undefined}
                    />
                    <span aria-hidden="true">→</span>
                    <input
                      type="time"
                      value={block.end}
                      onChange={(e) => update(block.key, { end: e.target.value })}
                      aria-label={`${day} end time`}
                      aria-invalid={!!errors[block.key] || undefined}
                    />
                    <button type="button" className="icon-btn" aria-label={`Remove ${day} ${block.start} block`} onClick={() => remove(block.key)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  {errors[block.key] ? <p className="field-error">{errors[block.key]}</p> : null}
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <div className="card save-bar">
        <div>
          <span className="muted small">Weekly capacity</span>
          <strong className="big-number">{formatHours(Math.round(weeklyHours * 10) / 10)}</strong>
        </div>
        <FormError message={replace.isError ? serverErrors(replace.error).form : null} />
        <div className="row gap-sm">
          {dirty ? <span className="muted small">Unsaved changes</span> : null}
          <button type="button" className="btn primary" disabled={hasErrors || replace.isPending || !dirty} onClick={save}>
            {replace.isPending ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
