"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import type { Task } from "@/lib/api/types";
import { formatDue, formatLongDate, relativeDay } from "@/lib/format";
import { useProject, useProjectActivity, useRemoveProjectMember, useTasks, useUpdateProject } from "@/lib/queries";

import { AddMemberDialog } from "@/components/projects/AddMemberDialog";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { serverErrors } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Avatar, Badge, PageHeader, MemberTags, ProgressBar, SectionHeader, StageBadge, StatCard, Tabs } from "@/components/ui/Primitives";
import { PageHeaderSkeleton, StatGridSkeleton, TaskListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type Tab = "overview" | "tasks" | "researchers" | "activity";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProject(projectId);
  const [tab, setTab] = useState<Tab>("overview");
  const [dialog, setDialog] = useState<"edit" | "task" | "member" | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const updateProject = useUpdateProject();
  const toast = useToast();

  if (project.isPending) {
    return (
      <div className="page">
        <PageHeaderSkeleton />
        <StatGridSkeleton count={4} />
        <div className="card">
          <TaskListSkeleton />
        </div>
      </div>
    );
  }
  if (project.isError) {
    if (project.error instanceof ApiError && project.error.status === 404) {
      return <NotFoundState what="Project" backHref="/projects" backLabel="Back to projects" />;
    }
    return <ErrorState title="Couldn't load this project" error={project.error} onRetry={() => project.refetch()} />;
  }

  const p = project.data;
  const toggleArchive = () =>
    updateProject.mutate(
      { id: p.project_id, body: { is_archived: !p.is_archived } },
      {
        onSuccess: () => toast.success(p.is_archived ? "Project restored" : "Project archived"),
        onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't update the project"),
      },
    );

  return (
    <div className="page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link> <Icon name="chevronRight" size={12} /> <span>{p.name}</span>
      </nav>
      <PageHeader
        title={p.name}
        description={
          <span className="row gap-sm wrap">
            {p.is_archived ? <Badge tone="muted">Archived</Badge> : <StageBadge stage={p.stage} />}
            {p.research_track ? <Badge tone="info">{p.research_track}</Badge> : null}
            {p.github_repository ? (
              <a href={`https://github.com/${p.github_repository}`} target="_blank" rel="noreferrer" className="github-link">
                <Icon name="github" size={13} /> {p.github_repository}
              </a>
            ) : null}
          </span>
        }
        actions={
          p.viewer_can_manage ? (
            <>
              <button type="button" className="btn ghost" onClick={toggleArchive} disabled={updateProject.isPending}>
                {p.is_archived ? "Restore" : "Archive"}
              </button>
              <button type="button" className="btn" onClick={() => setDialog("edit")}>
                <Icon name="edit" /> Edit project
              </button>
              {!p.is_archived ? (
                <button type="button" className="btn primary" onClick={() => setDialog("task")}>
                  <Icon name="plus" /> New task
                </button>
              ) : null}
            </>
          ) : null
        }
      />

      <Tabs<Tab>
        label="Project sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "tasks", label: "Tasks", count: p.stats.open_task_count + p.stats.completed_task_count },
          { value: "researchers", label: "Researchers", count: p.members.length },
          { value: "activity", label: "Activity" },
        ]}
      />

      {tab === "overview" ? (
        <Overview projectId={p.project_id} onShowTasks={() => setTab("tasks")} />
      ) : tab === "tasks" ? (
        <ProjectTasks projectId={p.project_id} canManage={p.viewer_can_manage && !p.is_archived} onNew={() => setDialog("task")} onEdit={setEditingTask} />
      ) : tab === "researchers" ? (
        <Researchers projectId={p.project_id} onAdd={() => setDialog("member")} />
      ) : (
        <Activity projectId={p.project_id} />
      )}

      <ProjectFormDialog open={dialog === "edit"} onClose={() => setDialog(null)} project={p} />
      <TaskFormDialog open={dialog === "task"} onClose={() => setDialog(null)} defaults={{ project_id: p.project_id }} />
      <TaskFormDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      <AddMemberDialog open={dialog === "member"} onClose={() => setDialog(null)} project={p} />
    </div>
  );
}

function Overview({ projectId, onShowTasks }: { projectId: string; onShowTasks: () => void }) {
  const { data: p } = useProject(projectId);
  if (!p) return null;
  return (
    <div className="stack-lg">
      <div className="stat-grid four">
        <StatCard label="Progress" value={`${p.stats.progress_percent}%`} hint={<ProgressBar percent={p.stats.progress_percent} label="Progress" />} />
        <StatCard label="Researchers" value={p.stats.member_count} />
        <StatCard
          label="Active tasks"
          value={p.stats.open_task_count}
          hint={p.stats.blocked_task_count ? `${p.stats.blocked_task_count} blocked` : `${p.stats.completed_task_count} completed`}
          tone={p.stats.blocked_task_count ? "warning" : undefined}
        />
        <StatCard
          label="Upcoming deadline"
          value={p.stats.next_deadline_at ? formatDue(p.stats.next_deadline_at) : "—"}
          hint={p.stats.overdue_task_count ? `${p.stats.overdue_task_count} overdue` : undefined}
          tone={p.stats.overdue_task_count ? "danger" : undefined}
        />
      </div>
      <div className="dashboard-grid">
        <section className="card stack-md">
          <SectionHeader title="Research" />
          <dl className="definition">
            <dt>Research question</dt>
            <dd>{p.research_question || <span className="muted">Not set yet</span>}</dd>
            <dt>Hypothesis</dt>
            <dd>{p.hypothesis || <span className="muted">Not set yet</span>}</dd>
            {p.description ? (
              <>
                <dt>Description</dt>
                <dd>{p.description}</dd>
              </>
            ) : null}
          </dl>
          <button type="button" className="link-btn" onClick={onShowTasks}>
            View tasks →
          </button>
        </section>
        <section className="card">
          <SectionHeader title="Details" />
          <dl className="definition compact">
            <dt>Project manager</dt>
            <dd>{p.project_manager?.display_name ?? "—"}</dd>
            <dt>Research lead</dt>
            <dd>{p.research_lead?.display_name ?? "—"}</dd>
            <dt>Start date</dt>
            <dd>{formatLongDate(p.start_date)}</dd>
            <dt>Target date</dt>
            <dd>{formatLongDate(p.target_date)}</dd>
            <dt>GitHub project</dt>
            <dd>
              {p.github_project_url ? (
                <a href={p.github_project_url} target="_blank" rel="noreferrer">
                  Open board <Icon name="external" size={12} />
                </a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}

function ProjectTasks({
  projectId,
  canManage,
  onNew,
  onEdit,
}: {
  projectId: string;
  canManage: boolean;
  onNew: () => void;
  onEdit: (task: Task) => void;
}) {
  const tasks = useTasks({ project_id: projectId });
  const [view, setView] = useState<"board" | "list">("board");

  if (tasks.isPending) return <div className="card"><TaskListSkeleton rows={5} /></div>;
  if (tasks.isError) return <ErrorState title="Couldn't load tasks" error={tasks.error} onRetry={() => tasks.refetch()} />;
  if (tasks.data.length === 0) {
    return (
      <EmptyState
        icon="work"
        title="No tasks in this project yet"
        description={canManage ? "Break the research into tasks and assign them to researchers." : "Tasks will show up here once a project manager adds them."}
        action={canManage ? <button type="button" className="btn primary" onClick={onNew}>Create task</button> : undefined}
      />
    );
  }
  return (
    <div className="stack-md">
      <div className="row space-between">
        <Tabs label="Task view" value={view} onChange={setView} tabs={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} />
      </div>
      {view === "board" ? (
        <TaskBoard tasks={tasks.data} onEdit={canManage ? onEdit : undefined} />
      ) : (
        <div className="card">
          <TaskList tasks={tasks.data} showProject={false} onEdit={canManage ? onEdit : undefined} />
        </div>
      )}
    </div>
  );
}

function Researchers({ projectId, onAdd }: { projectId: string; onAdd: () => void }) {
  const { data: p } = useProject(projectId);
  const remove = useRemoveProjectMember();
  const toast = useToast();
  if (!p) return null;
  const canManage = p.viewer_can_manage;

  return (
    <section className="card">
      <SectionHeader
        title="Researchers"
        action={canManage ? <button type="button" className="btn" onClick={onAdd}><Icon name="plus" /> Add researcher</button> : undefined}
      />
      {p.members.length === 0 ? (
        <EmptyState
          icon="users"
          title="No researchers on this project"
          description="Add researchers directly, or assign them a task and they'll join automatically."
          action={canManage ? <button type="button" className="btn primary" onClick={onAdd}>Add researcher</button> : undefined}
          compact
        />
      ) : (
        <ul className="member-list">
          {p.members.map((m) => (
            <li key={m.user_id}>
              <Avatar name={m.display_name} />
              <span className="grow stack-xs">
                {canManage ? <Link href={`/team/${m.user_id}`}>{m.display_name}</Link> : <strong>{m.display_name}</strong>}
                <span className="muted small">
                  {m.open_task_count} open task{m.open_task_count === 1 ? "" : "s"} · joined {relativeDay(m.added_at)}
                </span>
              </span>
              <MemberTags status={m.research_status} commitment={m.commitment} />
              {canManage ? (
                <button
                  type="button"
                  className="link-btn"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(
                      { projectId: p.project_id, userId: m.user_id },
                      {
                        onSuccess: () => toast.success(`${m.display_name} removed from ${p.name}`),
                        onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't remove researcher"),
                      },
                    )
                  }
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Activity({ projectId }: { projectId: string }) {
  const activity = useProjectActivity(projectId);
  if (activity.isPending) return <div className="card"><TaskListSkeleton rows={4} /></div>;
  if (activity.isError) return <ErrorState title="Couldn't load activity" error={activity.error} onRetry={() => activity.refetch()} />;
  if (activity.data.length === 0) return <EmptyState icon="clock" title="No activity yet" />;
  return (
    <section className="card">
      <ul className="activity-list">
        {activity.data.map((a, i) => (
          <li key={i}>
            <span className={`activity-dot kind-${a.kind}`} aria-hidden="true" />
            {a.link ? <Link href={a.link}>{a.text}</Link> : <span>{a.text}</span>}
            <time className="muted small">{relativeDay(a.occurred_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
