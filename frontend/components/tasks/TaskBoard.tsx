"use client";

import Link from "next/link";

import type { Task, TaskStatus } from "@/lib/api/types";
import { formatDue, formatHours, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/format";

import { PriorityBadge } from "@/components/ui/Primitives";

import { TaskStatusControl } from "./TaskList";

/** A read-mostly board: status changes go through the select on each card (no drag and drop yet). */
export function TaskBoard({ tasks, onEdit }: { tasks: Task[]; onEdit?: (task: Task) => void }) {
  const columns = TASK_STATUSES.map((status) => ({ status, tasks: tasks.filter((t) => t.status === status) }));
  return (
    <div className="board">
      {columns.map(({ status, tasks: columnTasks }) => (
        <section key={status} className="board-column" aria-label={TASK_STATUS_LABEL[status]}>
          <header className={`board-column-header status-${status.toLowerCase()}`}>
            <span>{TASK_STATUS_LABEL[status as TaskStatus]}</span>
            <span className="muted">{columnTasks.length}</span>
          </header>
          {columnTasks.length === 0 ? <p className="board-empty">No tasks</p> : null}
          {columnTasks.map((task) => (
            <article key={task.task_id} className="board-card">
              <Link href={`/projects/${task.project_id}/tasks/${task.task_id}`} className="task-title">
                {task.title}
              </Link>
              <div className="task-meta">
                <span>{task.assignee?.display_name ?? "Unassigned"}</span>
                {task.deadline_at ? (
                  <span className={task.is_overdue ? "text-danger" : undefined}>{formatDue(task.deadline_at)}</span>
                ) : null}
                {task.estimated_hours != null ? <span>{formatHours(task.estimated_hours)}</span> : null}
              </div>
              <div className="board-card-footer">
                <PriorityBadge priority={task.priority} />
                <TaskStatusControl task={task} />
                {onEdit && task.viewer_can_manage ? (
                  <button type="button" className="link-btn" onClick={() => onEdit(task)}>
                    Edit
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
