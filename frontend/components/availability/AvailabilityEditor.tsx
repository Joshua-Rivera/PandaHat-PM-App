"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Availability } from "@/lib/api/types";
import { formatHours, WEEKDAYS } from "@/lib/format";
import { useReplaceAvailability } from "@/lib/queries";

import { FormError, serverErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

const SLOT = 30; // minutes per row
const DAY_START = 8 * 60;
const DAY_END = 23 * 60;

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hourLabel = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
};
const key = (day: number, start: number) => `${day}-${start}`;

/** Saved blocks → set of painted half-hour cells (rounded outward to the half hour). */
function toCells(initial: Availability): Set<string> {
  const cells = new Set<string>();
  for (const b of initial.blocks) {
    const from = Math.floor(minutes(b.start_time) / SLOT) * SLOT;
    const to = Math.ceil(minutes(b.end_time) / SLOT) * SLOT;
    for (let t = from; t < to; t += SLOT) cells.add(key(b.weekday, t));
  }
  return cells;
}

/** Painted cells → contiguous blocks per day, the shape the API stores. */
function toBlocks(cells: Set<string>) {
  const blocks: { weekday: number; start_time: string; end_time: string }[] = [];
  for (let day = 0; day < 7; day++) {
    const starts = [...cells]
      .filter((c) => c.startsWith(`${day}-`))
      .map((c) => Number(c.split("-")[1]))
      .sort((a, b) => a - b);
    let runStart: number | null = null;
    starts.forEach((t, i) => {
      if (runStart === null) runStart = t;
      if (starts[i + 1] !== t + SLOT) {
        blocks.push({ weekday: day, start_time: hhmm(runStart), end_time: hhmm(Math.min(t + SLOT, 23 * 60 + 59)) });
        runStart = null;
      }
    });
  }
  return blocks;
}

const snapshot = (cells: Set<string>) => [...cells].sort().join(",");

/**
 * when2meet-style editor: press on a half hour and drag to paint the times you're free.
 * Starting on a free cell erases instead. Works with mouse, touch and pen.
 */
export function AvailabilityEditor({ initial }: { initial: Availability }) {
  const [cells, setCells] = useState(() => toCells(initial));
  const [saved, setSaved] = useState(() => snapshot(toCells(initial)));
  const drag = useRef<{ adding: boolean; anchor: string; base: Set<string> } | null>(null);
  const replace = useReplaceAvailability();
  const toast = useToast();

  const range = useMemo(() => {
    const starts = [...toCells(initial)].map((c) => Number(c.split("-")[1]));
    return {
      from: Math.min(DAY_START, ...starts),
      to: Math.max(DAY_END, ...starts.map((s) => s + SLOT)),
    };
  }, [initial]);
  const slots: number[] = [];
  for (let t = range.from; t < range.to; t += SLOT) slots.push(t);

  useEffect(() => {
    const stop = () => (drag.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  /** Fill (or clear) the rectangle between where the drag started and the cell under the pointer. */
  const paintTo = (k: string) => {
    const d = drag.current;
    if (!d) return;
    const [d1, t1] = d.anchor.split("-").map(Number);
    const [d2, t2] = k.split("-").map(Number);
    const next = new Set(d.base);
    for (let day = Math.min(d1, d2); day <= Math.max(d1, d2); day++) {
      for (let t = Math.min(t1, t2); t <= Math.max(t1, t2); t += SLOT) {
        if (d.adding) next.add(key(day, t));
        else next.delete(key(day, t));
      }
    }
    setCells(next);
  };
  const toggle = (k: string) =>
    setCells((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const cellAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.dataset.cell;

  const weeklyHours = (cells.size * SLOT) / 60;
  const dirty = snapshot(cells) !== saved;

  const save = () => {
    replace.mutate(toBlocks(cells), {
      onSuccess: (result) => {
        setSaved(snapshot(cells));
        toast.success(`Availability saved: ${formatHours(result.weekly_capacity_hours)} per week`);
      },
    });
  };

  return (
    <div className="stack-lg">
      <div className="card paint-card">
        <div className="paint-help muted small">
          <span>Press and drag across days and times to mark when you&apos;re free. Start on green to clear.</span>
          <span className="row gap-xs">
            <i className="legend-swatch" /> Free
          </span>
        </div>
        <div
          className="heatmap paint-grid"
          style={{ gridTemplateColumns: `52px repeat(7, minmax(0, 1fr))` }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const k = cellAt(e.clientX, e.clientY);
            if (k) paintTo(k);
          }}
        >
          <span className="heatmap-corner" />
          {WEEKDAYS.map((d) => (
            <span key={d} className="heatmap-day">
              <span className="day-long">{d.slice(0, 3)}</span>
              <span className="day-short">{d[0]}</span>
            </span>
          ))}
          {slots.map((start) => (
            <PaintRow key={start} start={start}>
              {WEEKDAYS.map((d, day) => {
                const k = key(day, start);
                const on = cells.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    data-cell={k}
                    className={`heat-cell paint-cell${start % 60 === 0 ? " hour" : ""}${on ? " on" : ""}`}
                    aria-pressed={on}
                    aria-label={`${d} ${hhmm(start)}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                      drag.current = { adding: !on, anchor: k, base: cells };
                      paintTo(k);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        toggle(k);
                      }
                    }}
                  />
                );
              })}
            </PaintRow>
          ))}
        </div>
      </div>

      <div className="card save-bar">
        <div>
          <span className="muted small">Weekly capacity</span>
          <strong className="big-number">{formatHours(weeklyHours)}</strong>
        </div>
        <FormError message={replace.isError ? serverErrors(replace.error).form : null} />
        <div className="row gap-sm">
          {cells.size ? (
            <button type="button" className="btn ghost" onClick={() => setCells(new Set())}>
              Clear all
            </button>
          ) : null}
          {dirty ? <span className="muted small">Unsaved changes</span> : null}
          <button type="button" className="btn primary" disabled={replace.isPending || !dirty} onClick={save}>
            {replace.isPending ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaintRow({ start, children }: { start: number; children: React.ReactNode }) {
  return (
    <>
      <span className="heatmap-time">{start % 60 === 0 ? hourLabel(start) : ""}</span>
      {children}
    </>
  );
}
