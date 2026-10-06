import Link from "next/link";
import type { ReactNode } from "react";

import type { CapacityState, Commitment, ProjectStage, ResearchStatus, TaskPriority, TaskStatus, Workload } from "@/lib/api/types";
import {
  CAPACITY_LABEL,
  COMMITMENT_SHORT,
  formatHours,
  initials,
  PRIORITY_LABEL,
  RESEARCH_STATUS_LABEL,
  STAGE_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
  hero = false,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  hero?: boolean;
}) {
  return (
    <div className={hero ? "page-header hero" : "page-header"}>
      <div>
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "warning" | "danger" | "success";
  href?: string;
}) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className={`stat-value${tone ? ` tone-${tone}` : ""}`}>{value}</span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="card stat-card interactive">
      {body}
    </Link>
  ) : (
    <div className="card stat-card">{body}</div>
  );
}

export function ProgressBar({ percent, label, tone }: { percent: number; label?: string; tone?: "success" | "warning" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`progress${tone ? ` tone-${tone}` : ""}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

const CAPACITY_TONE: Record<CapacityState, "success" | "warning" | "danger" | undefined> = {
  AVAILABLE: undefined,
  AT_CAPACITY: "warning",
  OVERLOADED: "danger",
  NO_AVAILABILITY: undefined,
};

export function CapacityBar({ workload, showLabel = true }: { workload: Workload; showLabel?: boolean }) {
  const { assigned_hours: assigned, capacity_hours: capacity, capacity_state: state } = workload;
  const percent = capacity > 0 ? (assigned / capacity) * 100 : assigned > 0 ? 100 : 0;
  return (
    <div className="capacity">
      <ProgressBar percent={percent} tone={CAPACITY_TONE[state]} label={`${assigned} of ${capacity} hours assigned`} />
      {showLabel ? (
        <div className="capacity-meta">
          <span>
            {formatHours(assigned)} / {formatHours(capacity)}
          </span>
          <CapacityBadge state={state} />
        </div>
      ) : null}
      {showLabel && workload.below_commitment ? (
        <span className="capacity-warning">Availability below the {formatHours(workload.committed_hours)} commitment</span>
      ) : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge-pill tone-${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<TaskStatus, string> = { TODO: "neutral", IN_PROGRESS: "info", BLOCKED: "danger", COMPLETED: "success" };
export const StatusBadge = ({ status }: { status: TaskStatus }) => <Badge tone={STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>;

const PRIORITY_TONE: Record<TaskPriority, string> = { LOW: "muted", MEDIUM: "neutral", HIGH: "warning", URGENT: "danger" };
export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
);

const RESEARCH_TONE: Record<ResearchStatus, string> = { LEARNING_PATH: "info", RESEARCH: "success" };
export const ResearchStatusBadge = ({ status }: { status: ResearchStatus }) => (
  <Badge tone={RESEARCH_TONE[status]}>{RESEARCH_STATUS_LABEL[status]}</Badge>
);

/** Track + commitment, the two tags a PM gives each member. */
export const MemberTags = ({ status, commitment }: { status: ResearchStatus; commitment: Commitment }) => (
  <span className="tag-row">
    <ResearchStatusBadge status={status} />
    <Badge tone={commitment === "FULL_TIME" ? "neutral" : "muted"}>{COMMITMENT_SHORT[commitment]}</Badge>
  </span>
);

export const StageBadge = ({ stage }: { stage: ProjectStage }) => <Badge tone="neutral">{STAGE_LABEL[stage]}</Badge>;

const CAP_TONE: Record<CapacityState, string> = { AVAILABLE: "success", AT_CAPACITY: "warning", OVERLOADED: "danger", NO_AVAILABILITY: "muted" };
export const CapacityBadge = ({ state }: { state: CapacityState }) => <Badge tone={CAP_TONE[state]}>{CAPACITY_LABEL[state]}</Badge>;

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className="tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
