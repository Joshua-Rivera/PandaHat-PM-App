"use client";

import Link from "next/link";

import type { Task } from "@/lib/api/types";
import { formatDue, formatHours, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/format";
import { useMoveTask } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import { serverErrors } from "@/components/ui/Form";
import { PriorityBadge } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/Toast";

import { BoardDnd, canDrag, DraggableCard, dropId, DropZone } from "./dnd";
import { TaskStatusControl } from "./TaskList";

/** Project board: drag cards between status columns (or use the status menu on each card). */
export function TaskBoard({ tasks, onEdit }: { tasks: Task[]; onEdit?: (task: Task) => void }) {
  const { me } = useSession();
  const move = useMoveTask();
  const toast = useToast();

  return (
    <BoardDnd
      tasks={tasks}
      viewer={me}
      renderOverlay={(task) => <CardBody task={task} />}
      onMove={(task, { status }) => {
        if (status === task.status) return;
        move.mutate(
          { task, status },
          { onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't move the task") },
        );
      }}
    >
      <div className="board">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          return (
            <DropZone key={status} id={dropId(status)} className="board-column" aria-label={TASK_STATUS_LABEL[status]}>
              <header className={`board-column-header status-${status.toLowerCase()}`}>
                <span>{TASK_STATUS_LABEL[status]}</span>
                <span className="muted">{columnTasks.length}</span>
              </header>
              {columnTasks.length === 0 ? <p className="board-empty">No tasks</p> : null}
              {columnTasks.map((task) => (
                <DraggableCard key={task.task_id} task={task} disabled={!canDrag(task, me)} className="board-card">
                  <CardBody task={task} onEdit={onEdit} />
                </DraggableCard>
              ))}
            </DropZone>
          );
        })}
      </div>
    </BoardDnd>
  );
}

function CardBody({ task, onEdit }: { task: Task; onEdit?: (task: Task) => void }) {
  return (
    <>
      <Link href={`/projects/${task.project_id}/tasks/${task.task_id}`} className="task-title">
        {task.title}
      </Link>
      <div className="task-meta">
        <span>{task.assignee?.display_name ?? "Unassigned"}</span>
        {task.deadline_at ? <span className={task.is_overdue ? "text-danger" : undefined}>{formatDue(task.deadline_at)}</span> : null}
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
    </>
  );
}
