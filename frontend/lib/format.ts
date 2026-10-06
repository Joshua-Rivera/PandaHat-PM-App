import type { CapacityState, Commitment, ProjectStage, ResearchStatus, Role, TaskPriority, TaskStatus } from "@/lib/api/types";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABEL) as TaskStatus[];

export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
export const PRIORITIES = Object.keys(PRIORITY_LABEL) as TaskPriority[];

export const STAGE_LABEL: Record<ProjectStage, string> = {
  PLANNING: "Planning",
  LITERATURE_REVIEW: "Literature review",
  EXPERIMENT_DESIGN: "Experiment design",
  EXPERIMENT_VALIDATION: "Experiment validation",
  ANALYSIS: "Analysis",
  WRITING: "Writing",
  COMPLETE: "Complete",
};
export const STAGES = Object.keys(STAGE_LABEL) as ProjectStage[];

export const RESEARCH_STATUS_LABEL: Record<ResearchStatus, string> = {
  LEARNING_PATH: "Learning Path",
  RESEARCH: "Research",
};
export const RESEARCH_STATUSES = Object.keys(RESEARCH_STATUS_LABEL) as ResearchStatus[];

export const COMMITMENT_HOURS: Record<Commitment, number> = { SHADOW: 5, FULL_TIME: 10 };
export const COMMITMENT_LABEL: Record<Commitment, string> = {
  SHADOW: "Shadow researcher",
  FULL_TIME: "Full-time researcher",
};
export const COMMITMENT_SHORT: Record<Commitment, string> = { SHADOW: "Shadow · 5h", FULL_TIME: "Full-time · 10h" };
export const COMMITMENTS = Object.keys(COMMITMENT_LABEL) as Commitment[];

export const ROLE_LABEL: Record<Role, string> = { researcher: "Researcher", pm: "Project Manager", admin: "Admin" };
export const ROLE_SHORT: Record<Role, string> = { researcher: "Researcher", pm: "PM", admin: "Admin" };

export const CAPACITY_LABEL: Record<CapacityState, string> = {
  NO_AVAILABILITY: "No availability",
  AVAILABLE: "Available",
  AT_CAPACITY: "At capacity",
  OVERLOADED: "Overloaded",
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SHORT_DATE = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const LONG_DATE = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** Parses both "2026-10-08" (a calendar date, kept local) and full ISO timestamps. */
export function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export const formatShortDate = (value: string | null) => (value ? SHORT_DATE.format(parseDate(value)) : "—");
export const formatLongDate = (value: string | null) => (value ? LONG_DATE.format(parseDate(value)) : "—");

// Due dates are calendar dates ("due Oct 9"), not instants. They are stored as
// 23:59 UTC on that date and always read back in UTC, so the server (which
// writes "due Fri 09 Oct" into notifications) and every browser agree on the
// day regardless of timezone.

/** <input type="date"> value ("YYYY-MM-DD") → that date at 23:59 UTC. */
export function dateInputToDeadline(value: string): string | null {
  return value ? `${value}T23:59:00Z` : null;
}

/** Deadline timestamp → its calendar date "YYYY-MM-DD" (UTC), e.g. for <input type="date">. */
export function deadlineToDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export const formatDue = (iso: string | null) => formatShortDate(iso ? deadlineToDateInput(iso) : null);
export const formatDueLong = (iso: string | null) => formatLongDate(iso ? deadlineToDateInput(iso) : null);

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "today", "yesterday", "3 days ago", or a short date for anything older than two weeks. */
export function relativeDay(iso: string, now = new Date()): string {
  const then = parseDate(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(then) - startOf(now)) / 86_400_000);
  if (Math.abs(days) > 14) return formatShortDate(iso);
  return RTF.format(days, "day");
}
