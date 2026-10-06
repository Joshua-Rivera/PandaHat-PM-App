"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { Me, Task, TaskStatus } from "@/lib/api/types";
import { TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/format";

import { Icon } from "@/components/ui/Icon";

// ── Drop target ids: "STATUS" on a plain board, "laneId:STATUS" on the swimlane board ──
export type DropTarget = { lane: string | null; status: TaskStatus };

export const dropId = (status: TaskStatus, lane?: string) => (lane ? `${lane}:${status}` : status);

export function parseDropId(id: string): DropTarget | null {
  const i = id.lastIndexOf(":");
  const status = (i === -1 ? id : id.slice(i + 1)) as TaskStatus;
  if (!TASK_STATUSES.includes(status)) return null;
  return { lane: i === -1 ? null : id.slice(0, i), status };
}

type Viewer = Pick<Me, "user_id" | "is_manager">;

/** Who may pick a card up. Mirrors the API: PMs move anything; assignees move their own open work. */
export function canDrag(task: Task, viewer: Viewer): boolean {
  if (viewer.is_manager) return true;
  return task.viewer_can_update_status && task.status !== "COMPLETED";
}

/** Where a card may land. Researchers stay in their own lane and can't complete work (PM-only). */
export function canDrop(task: Task, target: DropTarget, viewer: Viewer): boolean {
  if (viewer.is_manager) return true;
  if (!canDrag(task, viewer) || task.assignee_user_id !== viewer.user_id) return false;
  if (target.status === "COMPLETED") return false;
  return target.lane === null || target.lane === viewer.user_id;
}

// ── Board context ──
type ActiveDrag = { task: Task | null; allowed: (target: DropTarget) => boolean };
const ActiveContext = createContext<ActiveDrag>({ task: null, allowed: () => true });

export function BoardDnd({
  tasks,
  viewer,
  laneName,
  onMove,
  renderOverlay,
  children,
}: {
  tasks: Task[];
  viewer: Viewer;
  laneName?: (lane: string) => string;
  onMove: (task: Task, target: DropTarget) => void;
  renderOverlay: (task: Task) => ReactNode;
  children: ReactNode;
}) {
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const find = (id: string | number) => tasks.find((t) => t.task_id === id);
  const where = (id: string | number | undefined) => {
    const target = id === undefined ? null : parseDropId(String(id));
    if (!target) return "";
    const lane = target.lane && laneName ? ` for ${laneName(target.lane)}` : "";
    return `${TASK_STATUS_LABEL[target.status]}${lane}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${find(a.id)?.title ?? "task"}. Use arrow keys to move, space to drop.`,
    onDragOver: ({ active: a, over }) => (over ? `${find(a.id)?.title} is over ${where(over.id)}` : "Not over a column"),
    onDragEnd: ({ active: a, over }) => (over ? `Moved ${find(a.id)?.title} to ${where(over.id)}` : "Dropped. Nothing changed."),
    onDragCancel: ({ active: a }) => `Cancelled moving ${find(a.id)?.title}.`,
  };

  return (
    <ActiveContext.Provider value={{ task: active, allowed: (target) => !active || canDrop(active, target, viewer) }}>
      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Press space to pick up a task, arrow keys to move it between columns, space again to drop." } }}
        onDragStart={({ active: a }) => setActive(find(a.id) ?? null)}
        onDragCancel={() => setActive(null)}
        onDragEnd={({ active: a, over }) => {
          setActive(null);
          const task = find(a.id);
          const target = over ? parseDropId(String(over.id)) : null;
          if (task && target && canDrop(task, target, viewer)) onMove(task, target);
        }}
      >
        {children}
        <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" }}>
          {active ? <div className="drag-overlay">{renderOverlay(active)}</div> : null}
        </DragOverlay>
      </DndContext>
    </ActiveContext.Provider>
  );
}

export function DropZone({
  id,
  className,
  children,
  ...rest
}: { id: string; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { task, allowed } = useContext(ActiveContext);
  const target = parseDropId(id);
  const locked = !!task && !!target && !allowed(target);
  return (
    <div
      ref={setNodeRef}
      className={`drop-zone ${className ?? ""}${isOver && !locked ? " is-over" : ""}${locked ? " is-locked" : ""}`}
      {...rest}
    >
      {locked ? (
        <span className="drop-lock" aria-hidden="true">
          <Icon name="lock" size={14} />
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Mouse/touch drag from anywhere on the card (except its controls); keyboard drag from the grip. */
export function DraggableCard({
  task,
  disabled,
  className,
  children,
}: {
  task: Task;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task.task_id, disabled });
  const fromControl = (e: React.SyntheticEvent) => !!(e.target as HTMLElement).closest("select, button:not(.drag-handle), input");
  return (
    <article
      ref={setNodeRef}
      className={`drag-card ${className ?? ""}${isDragging ? " dragging" : ""}${disabled ? "" : " can-drag"}`}
      onMouseDown={(e) => !disabled && !fromControl(e) && listeners?.onMouseDown?.(e)}
      onTouchStart={(e) => !disabled && !fromControl(e) && listeners?.onTouchStart?.(e)}
    >
      {disabled ? null : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="drag-handle"
          aria-label={`Move ${task.title}`}
          {...attributes}
          aria-roledescription="draggable task"
          onKeyDown={(e) => listeners?.onKeyDown?.(e)}
        >
          <Icon name="grip" size={14} />
        </button>
      )}
      {children}
    </article>
  );
}
