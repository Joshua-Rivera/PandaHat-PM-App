"use client";

import { Fragment, useMemo, useState } from "react";

import type { TeamMemberAvailability } from "@/lib/api/types";
import { WEEKDAYS } from "@/lib/format";

import { Avatar } from "@/components/ui/Primitives";

const SLOT = 30; // minutes per row

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function label(min: number): string {
  const h = Math.floor(min / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

function clock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function isFree(member: TeamMemberAvailability, day: number, start: number): boolean {
  return member.blocks.some(
    (b) => b.weekday === day && minutes(b.start_time) <= start && minutes(b.end_time) >= start + SLOT,
  );
}

type Cell = { day: number; start: number };

/**
 * when2meet-style grid: one column per day, one row per half hour. A cell gets darker the more
 * people are free then. With a person focused, their own slots are drawn solid instead.
 */
export function AvailabilityHeatmap({
  members,
  days,
  focusId,
}: {
  members: TeamMemberAvailability[];
  days: number[];
  focusId?: string;
}) {
  const [active, setActive] = useState<Cell | null>(null);

  const range = useMemo(() => {
    const blocks = members.flatMap((m) => m.blocks.filter((b) => days.includes(b.weekday)));
    if (!blocks.length) return { from: 9 * 60, to: 17 * 60 };
    const from = Math.floor(Math.min(...blocks.map((b) => minutes(b.start_time))) / 60) * 60;
    const to = Math.ceil(Math.max(...blocks.map((b) => minutes(b.end_time))) / 60) * 60;
    return { from, to };
  }, [members, days]);

  const slots: number[] = [];
  for (let t = range.from; t < range.to; t += SLOT) slots.push(t);

  const total = members.length;
  const focus = focusId ? members.find((m) => m.user_id === focusId) : undefined;
  const free = active ? members.filter((m) => isFree(m, active.day, active.start)) : [];
  const busy = active ? members.filter((m) => !free.includes(m)) : [];

  return (
    <div className="heatmap-layout">
      <div className="card heatmap-card">
        <div className="heatmap-legend muted small">
          {focus ? (
            <span className="row gap-xs">
              <i className="legend-swatch solid" /> {focus.display_name} is free
            </span>
          ) : (
            <>
              <span>0/{total} free</span>
              <i className="legend-ramp" aria-hidden="true" />
              <span>
                {total}/{total} free
              </span>
            </>
          )}
        </div>
        <div
          className="heatmap"
          style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}
          role="grid"
          aria-label="Team availability by half hour"
          onMouseLeave={() => setActive(null)}
        >
          <span className="heatmap-corner" />
          {days.map((d) => (
            <span key={d} className="heatmap-day" role="columnheader">
              <span className="day-long">{WEEKDAYS[d].slice(0, 3)}</span>
              <span className="day-short">{WEEKDAYS[d][0]}</span>
            </span>
          ))}
          {slots.map((start) => (
            <Fragment key={start}>
              <span className="heatmap-time">{start % 60 === 0 ? label(start) : ""}</span>
              {days.map((d) => {
                const count = members.filter((m) => isFree(m, d, start)).length;
                const level = focus ? (isFree(focus, d, start) ? 1 : 0) : total ? count / total : 0;
                const on = active?.day === d && active.start === start;
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    className={`heat-cell${start % 60 === 0 ? " hour" : ""}${on ? " active" : ""}${focus ? " focus" : ""}`}
                    style={{ "--level": level } as React.CSSProperties}
                    aria-label={`${WEEKDAYS[d]} ${clock(start)}: ${count} of ${total} free`}
                    onMouseEnter={() => setActive({ day: d, start })}
                    onFocus={() => setActive({ day: d, start })}
                    onClick={() => setActive({ day: d, start })}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <aside className="card heatmap-detail" aria-live="polite">
        {active ? (
          <>
            <p className="eyebrow">
              {WEEKDAYS[active.day]} · {clock(active.start)}–{clock(active.start + SLOT)}
            </p>
            <p className="heatmap-count">
              <strong>{free.length}</strong>
              <span className="muted"> / {total} free</span>
            </p>
            <PeopleList title="Available" people={free} />
            <PeopleList title="Unavailable" people={busy} dim />
          </>
        ) : (
          <p className="muted small">Hover or tap a time to see who&apos;s free.</p>
        )}
      </aside>
    </div>
  );

}

function PeopleList({ title, people, dim }: { title: string; people: TeamMemberAvailability[]; dim?: boolean }) {
  if (!people.length) return null;
  return (
    <div className="stack-xs">
      <span className="muted small">{title}</span>
      <ul className={`heatmap-people${dim ? " dim" : ""}`}>
        {people.map((p) => (
          <li key={p.user_id}>
            <Avatar name={p.display_name} size={22} />
            {p.display_name}
          </li>
        ))}
      </ul>
    </div>
  );
}
