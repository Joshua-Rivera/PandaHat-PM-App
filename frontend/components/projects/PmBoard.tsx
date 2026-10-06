"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Task } from "@/lib/api/types";
import {
  formatDue,
  formatHours,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/format";
import { useMoveTask, useResearchers, useTasks } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import {
  BoardDnd,
  canDrag,
  DraggableCard,
  dropId,
  DropZone,
} from "@/components/tasks/dnd";
import { TaskStatusControl } from "@/components/tasks/TaskList";
import { serverErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { Avatar, PriorityBadge, ProgressBar } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

const ALL = "";
const UNASSIGNED = "unassigned";

type Lane = { id: string; name: string; tasks: Task[] };

/** PM view across every project: one swimlane per member, one column per status. */
export function PmBoard() {
  const tasks = useTasks({});
  const researchers = useResearchers();
  const { me } = useSession();
  const move = useMoveTask();
  const toast = useToast();
  const [project, setProject] = useState(ALL);
  const [member, setMember] = useState(ALL);
  const [group, setGroup] = useState<"member" | "status">("member");

  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const projects = useMemo(
    () =>
      [
        ...new Map(all.map((t) => [t.project_id, t.project_name])).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [all],
  );
  const people = useMemo(() => {
    const byId = new Map(
      all
        .filter((t) => t.assignee)
        .map((t) => [t.assignee!.user_id, t.assignee!.display_name]),
    );
    researchers.data?.forEach((r) => byId.set(r.user_id, r.display_name));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, researchers.data]);

  const visible = all.filter(
    (t) =>
      (!project || t.project_id === project) &&
      (!member ||
        (member === UNASSIGNED ? !t.assignee : t.assignee?.user_id === member)),
  );

  const lanes: Lane[] =
    group === "status"
      ? [{ id: "all", name: "", tasks: visible }]
      : [
          // Every member gets a lane (even an empty one) so work can be dragged to them.
          ...people
            .filter(([id]) => !member || member === id)
            .map(([id, name]) => ({
              id,
              name,
              tasks: visible.filter((t) => t.assignee?.user_id === id),
            })),
          {
            id: UNASSIGNED,
            name: "Unassigned",
            tasks: visible.filter((t) => !t.assignee),
          },
        ].filter((l) => l.id !== UNASSIGNED || l.tasks.length || !member);

  const nameOf = (lane: string) =>
    lane === UNASSIGNED
      ? "Unassigned"
      : (people.find(([id]) => id === lane)?.[1] ?? "member");

  return (
    <div className="stack-lg">
      <div className="filter-bar" role="group" aria-label="Board filters">
        <label className="inline-field">
          <span className="muted small">Project</span>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value={ALL}>All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span className="muted small">Member</span>
          <select value={member} onChange={(e) => setMember(e.target.value)}>
            <option value={ALL}>Everyone</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
            <option value={UNASSIGNED}>Unassigned</option>
          </select>
        </label>
        <div className="segmented" role="radiogroup" aria-label="Group by">
          {(["member", "status"] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={group === g}
              className={group === g ? "on" : undefined}
              onClick={() => setGroup(g)}
            >
              {g === "member" ? "By member" : "By status"}
            </button>
          ))}
        </div>
      </div>

      {tasks.isPending ? (
        <TableSkeleton rows={4} columns={4} />
      ) : tasks.isError ? (
        <ErrorState
          title="Couldn't load tasks"
          error={tasks.error}
          onRetry={() => tasks.refetch()}
        />
      ) : lanes.length === 0 ? (
        <EmptyState
          icon="kanban"
          title="No tasks match"
          description="Try another project or member."
          compact
        />
      ) : (
        <BoardDnd
          tasks={visible}
          viewer={me}
          laneName={nameOf}
          renderOverlay={(t) => (
            <CardBody task={t} showOwner={group === "member"} />
          )}
          onMove={(task, target) => {
            const laneChanged =
              target.lane !== null &&
              target.lane !== (task.assignee?.user_id ?? UNASSIGNED);
            const statusChanged = target.status !== task.status;
            if (!laneChanged && !statusChanged) return;
            const assignee = !laneChanged
              ? undefined
              : target.lane === UNASSIGNED
                ? null
                : { user_id: target.lane!, display_name: nameOf(target.lane!) };
            move.mutate(
              {
                task,
                status: statusChanged ? target.status : undefined,
                assignee,
              },
              {
                onSuccess: () =>
                  laneChanged
                    ? toast.success(
                        assignee
                          ? `Assigned to ${assignee.display_name}`
                          : "Unassigned",
                      )
                    : undefined,
                onError: (e) =>
                  toast.error(serverErrors(e).form ?? "Couldn't move the task"),
              },
            );
          }}
        >
          <div className="pm-board">
            <div className="pm-board-head" aria-hidden="true">
              {group === "member" ? <span /> : null}
              {TASK_STATUSES.map((s) => (
                <span
                  key={s}
                  className={`board-column-header status-${s.toLowerCase()}`}
                >
                  {TASK_STATUS_LABEL[s]}
                  <span className="muted">
                    {visible.filter((t) => t.status === s).length}
                  </span>
                </span>
              ))}
            </div>
            {lanes.map((lane) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                showOwner={group === "member"}
                canMove={(t) => canDrag(t, me)}
              />
            ))}
          </div>
        </BoardDnd>
      )}
    </div>
  );
}

function LaneRow({
  lane,
  showOwner,
  canMove,
}: {
  lane: Lane;
  showOwner: boolean;
  canMove: (t: Task) => boolean;
}) {
  const done = lane.tasks.filter((t) => t.status === "COMPLETED").length;
  const pct = lane.tasks.length
    ? Math.round((done / lane.tasks.length) * 100)
    : 0;
  const open = lane.tasks.filter((t) => t.status !== "COMPLETED");
  const openHours = open.reduce((s, t) => s + (t.estimated_hours ?? 0), 0);
  const overdue = open.filter((t) => t.is_overdue).length;
  return (
    <section
      className={`pm-lane${showOwner ? "" : " no-owner"}`}
      aria-label={lane.name || "All tasks"}
    >
      {showOwner ? (
        <div className="pm-lane-owner">
          <div className="row gap-sm">
            <Avatar name={lane.name} size={32} />
            <strong>{lane.name}</strong>
          </div>
          <ProgressBar
            percent={pct}
            tone={pct === 100 ? "success" : undefined}
            label={`${lane.name} progress`}
          />
          <span className="muted small">
            {done}/{lane.tasks.length} done · {formatHours(openHours)} open
            {overdue ? (
              <span className="text-danger"> · {overdue} overdue</span>
            ) : null}
          </span>
        </div>
      ) : null}
      {TASK_STATUSES.map((s) => {
        const cards = lane.tasks.filter((t) => t.status === s);
        return (
          <DropZone
            key={s}
            id={showOwner ? dropId(s, lane.id) : dropId(s)}
            className="pm-cell"
            data-status={TASK_STATUS_LABEL[s]}
          >
            {cards.map((t) => (
              <DraggableCard
                key={t.task_id}
                task={t}
                disabled={!canMove(t)}
                className={`pm-card${t.is_overdue && s !== "COMPLETED" ? " overdue" : ""}`}
              >
                <CardBody task={t} showOwner={showOwner} />
              </DraggableCard>
            ))}
          </DropZone>
        );
      })}
    </section>
  );
}

function CardBody({ task: t, showOwner }: { task: Task; showOwner: boolean }) {
  return (
    <>
      <Link
        href={`/projects/${t.project_id}/tasks/${t.task_id}`}
        className="task-title"
      >
        {t.title}
      </Link>
      <span className="pm-card-project muted small">{t.project_name}</span>
      <div className="task-meta">
        {!showOwner && t.assignee ? (
          <span className="row gap-xs">
            <Avatar name={t.assignee.display_name} size={18} />
            {t.assignee.display_name}
          </span>
        ) : null}
        {t.deadline_at ? (
          <span className={t.is_overdue ? "text-danger" : undefined}>
            {formatDue(t.deadline_at)}
          </span>
        ) : null}
        {t.estimated_hours != null ? (
          <span>{formatHours(t.estimated_hours)}</span>
        ) : null}
      </div>
      <div className="board-card-footer">
        <PriorityBadge priority={t.priority} />
        <TaskStatusControl task={t} />
      </div>
    </>
  );
}
