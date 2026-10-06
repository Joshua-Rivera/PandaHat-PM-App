import type { Priority } from "@/lib/api/notifications";

const LABELS: Record<string, string> = {
  TASK_ASSIGNED: "New task",
  TASK_UNASSIGNED: "Task removed",
  DEADLINE_APPROACHING: "Deadline",
  DEADLINE_CHANGED: "Deadline changed",
  LEARNING_TASK_ASSIGNED: "Learning task",
  LEARNING_PATH_COMPLETED: "Learning complete",
  RESEARCH_READY: "Research ready",
  PROJECT_ASSIGNED: "Project",
  PROJECT_REMOVED: "Project",
  PM_ANNOUNCEMENT: "Announcement",
  GITHUB_PR_MERGED: "PR merged",
};

export function eventLabel(eventType: string): string {
  return LABELS[eventType] ?? eventType.replaceAll("_", " ").toLowerCase();
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "#8a8f98",
  NORMAL: "#6d8ff0",
  HIGH: "#d98a1c",
  URGENT: "#d23c3c",
};

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return RTF.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
