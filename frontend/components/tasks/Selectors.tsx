"use client";

import type { ProjectSummary, ResearcherSummary, TaskPriority, TaskStatus } from "@/lib/api/types";
import {
  CAPACITY_LABEL,
  formatHours,
  PRIORITIES,
  PRIORITY_LABEL,
  RESEARCH_STATUS_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/format";

import { CapacityBar } from "@/components/ui/Primitives";

export function StatusSelector({ id, value, onChange, disabled }: { id: string; value: TaskStatus; onChange: (v: TaskStatus) => void; disabled?: boolean }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as TaskStatus)} disabled={disabled}>
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export function PrioritySelector({ id, value, onChange }: { id: string; value: TaskPriority; onChange: (v: TaskPriority) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as TaskPriority)}>
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </select>
  );
}

export function ProjectSelector({
  id,
  value,
  onChange,
  projects,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  projects: ProjectSummary[];
  invalid?: boolean;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined}>
      <option value="">Choose a project…</option>
      {projects.map((p) => (
        <option key={p.project_id} value={p.project_id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/** Pick a person by name, with their current load visible, never by UUID. */
export function ResearcherSelector({
  id,
  value,
  onChange,
  researchers,
  extraHours = 0,
  placeholder = "Unassigned",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  researchers: ResearcherSummary[];
  /** Hours this task would add, to preview the effect on the chosen person. */
  extraHours?: number;
  placeholder?: string;
}) {
  const selected = researchers.find((r) => r.user_id === value);
  return (
    <div className="stack-sm">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {researchers.map((r) => (
          <option key={r.user_id} value={r.user_id}>
            {r.display_name} — {formatHours(r.workload.assigned_hours)} / {formatHours(r.workload.capacity_hours)} ·{" "}
            {CAPACITY_LABEL[r.workload.capacity_state]}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="selector-context">
          <span className="muted small">
            {RESEARCH_STATUS_LABEL[selected.research_status]}
            {selected.skills.length ? ` · ${selected.skills.join(", ")}` : ""}
          </span>
          <CapacityBar
            workload={{
              ...selected.workload,
              assigned_hours: selected.workload.assigned_hours + extraHours,
              capacity_state:
                selected.workload.capacity_hours > 0 &&
                selected.workload.assigned_hours + extraHours > selected.workload.capacity_hours
                  ? "OVERLOADED"
                  : selected.workload.capacity_state,
            }}
          />
          {extraHours > 0 ? <span className="muted small">Including this task ({formatHours(extraHours)})</span> : null}
        </div>
      ) : null}
    </div>
  );
}
