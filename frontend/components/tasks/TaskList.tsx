"use client";

import Link from "next/link";

import type { Task, TaskStatus } from "@/lib/api/types";
import { formatDue, formatHours, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/format";
import { useUpdateTask } from "@/lib/queries";

import { Icon } from "@/components/ui/Icon";
import { PriorityBadge, StatusBadge } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/Toast";
import { serverErrors } from "@/components/ui/Form";

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  BLOCKED: "IN_PROGRESS",
  COMPLETED: "TODO",
};

export function TaskStatusControl({ task, compact = false }: { task: Task; compact?: boolean }) {
  const update = useUpdateTask();
  const toast = useToast();
  const change = (status: TaskStatus) =>
    update.mutate(
      { id: task.task_id, body: { status } },
      {
        onSuccess: () => toast.success(`Marked ${TASK_STATUS_LABEL[status].toLowerCase()}`),
        onError: (error) => toast.error(serverErrors(error).form ?? "Couldn't update the task"),
      },
    );

  if (!task.viewer_can_update_status) return <StatusBadge status={task.status} />;
  if (compact) {
    const done = task.status === "COMPLETED";
    return (
      <button
        type="button"
        className={`status-check${done ? " done" : ""}`}
        aria-label={done ? `Reopen ${task.title}` : `Advance ${task.title} to ${TASK_STATUS_LABEL[NEXT_STATUS[task.status]]}`}
        title={done ? "Reopen" : `Move to ${TASK_STATUS_LABEL[NEXT_STATUS[task.status]]}`}
        disabled={update.isPending}
        onClick={() => change(NEXT_STATUS[task.status])}
      >
        {done ? <Icon name="check" size={12} /> : task.status === "IN_PROGRESS" ? <span className="half" /> : null}
      </button>
    );
  }
  return (
    <select
      className={`status-select status-${task.status.toLowerCase()}`}
      value={task.status}
      disabled={update.isPending}
      aria-label={`Status of ${task.title}`}
      onChange={(e) => change(e.target.value as TaskStatus)}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export function TaskList({
  tasks,
  showProject = true,
  showAssignee = true,
  showDescription = false,
  onEdit,
}: {
  tasks: Task[];
  showProject?: boolean;
  showAssignee?: boolean;
  showDescription?: boolean;
  onEdit?: (task: Task) => void;
}) {
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.task_id} className={`task-row${task.status === "COMPLETED" ? " is-done" : ""}`}>
          <TaskStatusControl task={task} compact />
          <div className="task-main">
            <Link href={`/projects/${task.project_id}/tasks/${task.task_id}`} className="task-title">
              {task.title}
            </Link>
            <div className="task-meta">
              {showProject ? <span>{task.project_name}</span> : null}
              {task.deadline_at ? (
                <span className={task.is_overdue ? "text-danger" : undefined}>
                  <Icon name="calendar" size={12} /> {task.is_overdue ? "Overdue · " : "Due "}
                  {formatDue(task.deadline_at)}
                </span>
              ) : null}
              {task.estimated_hours != null ? <span>Est. {formatHours(task.estimated_hours)}</span> : null}
              {showAssignee ? <span>{task.assignee ? task.assignee.display_name : "Unassigned"}</span> : null}
              {task.github_issue_url ? (
                <a href={task.github_issue_url} target="_blank" rel="noreferrer" className="github-link">
                  <Icon name="github" size={12} /> GitHub
                </a>
              ) : null}
            </div>
            {showDescription && task.description ? <p className="task-description">{task.description}</p> : null}
          </div>
          <div className="task-side">
            <PriorityBadge priority={task.priority} />
            <TaskStatusControl task={task} />
            {onEdit && task.viewer_can_manage ? (
              <button type="button" className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
                <Icon name="edit" />
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
