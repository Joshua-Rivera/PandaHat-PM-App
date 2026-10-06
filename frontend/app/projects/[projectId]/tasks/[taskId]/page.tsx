"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { formatDueLong, formatHours, relativeDay } from "@/lib/format";
import { useTask } from "@/lib/queries";

import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskStatusControl } from "@/components/tasks/TaskList";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHeader, PriorityBadge, SectionHeader } from "@/components/ui/Primitives";
import { PageHeaderSkeleton, TaskListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState, NotFoundState } from "@/components/ui/States";

export default function TaskPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const task = useTask(taskId);
  const [editing, setEditing] = useState(false);

  if (task.isPending) {
    return (
      <div className="page">
        <PageHeaderSkeleton />
        <div className="card">
          <TaskListSkeleton rows={3} />
        </div>
      </div>
    );
  }
  if (task.isError) {
    if (task.error instanceof ApiError && task.error.status === 404) {
      return <NotFoundState what="Task" backHref={`/projects/${projectId}`} backLabel="Back to project" />;
    }
    return <ErrorState title="Couldn't load this task" error={task.error} onRetry={() => task.refetch()} />;
  }
  const t = task.data;

  return (
    <div className="page narrow">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link> <Icon name="chevronRight" size={12} />
        <Link href={`/projects/${t.project_id}`}>{t.project_name}</Link> <Icon name="chevronRight" size={12} />
        <span>Task</span>
      </nav>
      <PageHeader
        title={t.title}
        description={
          <span className="row gap-sm wrap">
            <PriorityBadge priority={t.priority} />
            {t.is_overdue ? <Badge tone="danger">Overdue</Badge> : null}
            {t.is_archived ? <Badge tone="muted">Archived</Badge> : null}
            <Badge tone={t.source === "GITHUB_LINKED" ? "info" : "muted"}>{t.source === "GITHUB_LINKED" ? "GitHub-linked" : "Local task"}</Badge>
          </span>
        }
        actions={
          t.viewer_can_manage ? (
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <Icon name="edit" /> Edit task
            </button>
          ) : null
        }
      />
      <div className="dashboard-grid">
        <section className="card stack-md">
          <SectionHeader title="Description" />
          {t.description ? <p className="prewrap">{t.description}</p> : <p className="muted">No description.</p>}
          {t.required_skills.length ? (
            <div className="row gap-sm wrap">
              {t.required_skills.map((s) => (
                <Badge key={s} tone="neutral">
                  {s}
                </Badge>
              ))}
            </div>
          ) : null}
        </section>
        <section className="card">
          <SectionHeader title="Details" />
          <dl className="definition compact">
            <dt>Status</dt>
            <dd>
              <TaskStatusControl task={t} />
            </dd>
            <dt>Assignee</dt>
            <dd>{t.assignee?.display_name ?? "Unassigned"}</dd>
            <dt>Due</dt>
            <dd className={t.is_overdue ? "text-danger" : undefined}>{formatDueLong(t.deadline_at)}</dd>
            <dt>Estimate</dt>
            <dd>{formatHours(t.estimated_hours)}</dd>
            <dt>GitHub issue</dt>
            <dd>
              {t.github_issue_url ? (
                <a href={t.github_issue_url} target="_blank" rel="noreferrer" className="github-link">
                  <Icon name="github" size={12} /> Open issue
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>Created</dt>
            <dd>{relativeDay(t.created_at)}</dd>
            {t.completed_at ? (
              <>
                <dt>Completed</dt>
                <dd>{relativeDay(t.completed_at)}</dd>
              </>
            ) : null}
          </dl>
          {!t.viewer_can_update_status ? <p className="muted small">Only the assignee or a project manager can change this task.</p> : null}
        </section>
      </div>
      <TaskFormDialog open={editing} onClose={() => setEditing(false)} task={t} />
    </div>
  );
}
