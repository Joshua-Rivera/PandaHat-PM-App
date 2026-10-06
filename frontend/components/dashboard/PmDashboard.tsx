"use client";

import Link from "next/link";
import { useState } from "react";

import { formatHours, formatShortDate, relativeDay } from "@/lib/format";
import { useTeamOverview } from "@/lib/queries";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { Icon } from "@/components/ui/Icon";
import { Avatar, CapacityBar, PageHeader, SectionHeader, StatCard } from "@/components/ui/Primitives";
import { PageHeaderSkeleton, ProjectGridSkeleton, StatGridSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

import { AnnouncementDialog } from "./AnnouncementDialog";

export function PmDashboard() {
  const overview = useTeamOverview();
  const [dialog, setDialog] = useState<"task" | "project" | "announcement" | null>(null);
  const close = () => setDialog(null);

  const actions = (
    <>
      <button type="button" className="btn ghost" onClick={() => setDialog("announcement")}>
        <Icon name="megaphone" /> Announce
      </button>
      <button type="button" className="btn" onClick={() => setDialog("project")}>
        <Icon name="plus" /> New project
      </button>
      <button type="button" className="btn primary" onClick={() => setDialog("task")}>
        <Icon name="plus" /> New task
      </button>
    </>
  );
  const dialogs = (
    <>
      <TaskFormDialog open={dialog === "task"} onClose={close} />
      <ProjectFormDialog open={dialog === "project"} onClose={close} />
      <AnnouncementDialog open={dialog === "announcement"} onClose={close} />
    </>
  );

  if (overview.isPending) {
    return (
      <div className="page">
        <PageHeaderSkeleton />
        <StatGridSkeleton count={4} />
        <ProjectGridSkeleton />
        <TableSkeleton rows={4} columns={3} />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="page">
        <PageHeader title="PandaHat Research Overview" actions={actions} />
        <ErrorState title="Couldn't load the team overview" error={overview.error} onRetry={() => overview.refetch()} />
        {dialogs}
      </div>
    );
  }

  const o = overview.data;
  const attention = o.needs_attention;
  const attentionItems = [
    attention.overloaded_researchers.length && {
      tone: "danger",
      text: `${attention.overloaded_researchers.length} researcher${attention.overloaded_researchers.length === 1 ? "" : "s"} overloaded`,
      detail: attention.overloaded_researchers.map((r) => r.display_name).join(", "),
      href: "/workload",
    },
    attention.overdue_tasks.length && {
      tone: "danger",
      text: `${attention.overdue_tasks.length} task${attention.overdue_tasks.length === 1 ? "" : "s"} overdue`,
      detail: attention.overdue_tasks.map((t) => t.title).slice(0, 3).join(", "),
      href: `/projects/${attention.overdue_tasks[0].project_id}/tasks/${attention.overdue_tasks[0].task_id}`,
    },
    attention.blocked_tasks.length && {
      tone: "warning",
      text: `${attention.blocked_tasks.length} blocked task${attention.blocked_tasks.length === 1 ? "" : "s"}`,
      detail: attention.blocked_tasks.map((t) => t.title).slice(0, 3).join(", "),
      href: `/projects/${attention.blocked_tasks[0].project_id}/tasks/${attention.blocked_tasks[0].task_id}`,
    },
    attention.unassigned_open_task_count && {
      tone: "warning",
      text: `${attention.unassigned_open_task_count} open task${attention.unassigned_open_task_count === 1 ? "" : "s"} unassigned`,
      detail: "Assign them from the project page.",
      href: "/projects",
    },
    attention.researchers_without_availability.length && {
      tone: "muted",
      text: `${attention.researchers_without_availability.length} researcher${attention.researchers_without_availability.length === 1 ? " hasn't" : "s haven't"} entered availability`,
      detail: attention.researchers_without_availability.map((r) => r.display_name).join(", "),
      href: "/team",
    },
  ].filter(Boolean) as { tone: string; text: string; detail: string; href: string }[];

  if (o.researcher_count === 0 && o.projects.length === 0) {
    return (
      <div className="page">
        <PageHeader title="PandaHat Research Overview" actions={actions} />
        <EmptyState
          icon="folder"
          title="Let's set up your research group"
          description="Add your researchers on the Team page, then create your first project and start assigning tasks."
          action={
            <div className="row gap-sm">
              <Link className="btn" href="/team">
                Add researchers
              </Link>
              <button type="button" className="btn primary" onClick={() => setDialog("project")}>
                Create project
              </button>
            </div>
          }
        />
        {dialogs}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader hero title="PandaHat Research Overview" description="How the research group is doing this week." actions={actions} />

      <section className={`card attention${attentionItems.length ? "" : " calm"}`}>
        <SectionHeader title="Needs attention" />
        {attentionItems.length ? (
          <ul className="attention-list">
            {attentionItems.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className={`attention-item tone-${item.tone}`}>
                  <Icon name="alert" />
                  <span className="grow">
                    <strong>{item.text}</strong>
                    <span className="muted small">{item.detail}</span>
                  </span>
                  <Icon name="chevronRight" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            <Icon name="check" /> Nothing needs attention: no overdue, blocked or unassigned work.
          </p>
        )}
      </section>

      <div className="stat-grid four">
        <StatCard label="Researchers" value={o.researcher_count} href="/team" />
        <StatCard label="Learning Path" value={o.learning_path_count} hint={`${o.research_count} on Research`} href="/learning" />
        <StatCard label="Committed hours" value={formatHours(o.committed_hours_total)} hint={`${o.full_time_count} full-time · ${o.shadow_count} shadow`} href="/team/availability" />
        <StatCard
          label="Assigned hours"
          value={`${formatHours(o.assigned_hours_total)} / ${formatHours(o.capacity_hours_total)}`}
          hint="of weekly availability"
          tone={o.assigned_hours_total > o.capacity_hours_total ? "danger" : undefined}
          href="/workload"
        />
      </div>

      <section>
        <SectionHeader title="Projects" action={<Link href="/projects/manage">Manage projects</Link>} />
        {o.projects.length ? (
          <div className="project-grid">
            {o.projects.slice(0, 6).map((p) => (
              <ProjectCard key={p.project_id} project={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="folder"
            title="No projects yet"
            description="Create your first PandaHat research project to begin assigning researchers and tasks."
            action={
              <button type="button" className="btn primary" onClick={() => setDialog("project")}>
                Create project
              </button>
            }
          />
        )}
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <SectionHeader title="Team capacity" action={<Link href="/workload">Workload</Link>} />
          {o.team.length ? (
            <ul className="capacity-list">
              {o.team.slice(0, 8).map((r) => (
                <li key={r.user_id}>
                  <Link href={`/team/${r.user_id}`} className="capacity-person">
                    <Avatar name={r.display_name} size={24} />
                    <span>{r.display_name}</span>
                  </Link>
                  <CapacityBar workload={r.workload} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="users" title="No researchers yet" action={<Link className="btn" href="/team">Add researchers</Link>} compact />
          )}
        </section>

        <section className="card">
          <SectionHeader title="Recent activity" />
          {o.recent_activity.length ? (
            <ul className="activity-list">
              {o.recent_activity.map((a, i) => (
                <li key={i}>
                  <span className={`activity-dot kind-${a.kind}`} aria-hidden="true" />
                  {a.link ? <Link href={a.link}>{a.text}</Link> : <span>{a.text}</span>}
                  <time className="muted small" title={formatShortDate(a.occurred_at)}>
                    {relativeDay(a.occurred_at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No activity yet.</p>
          )}
        </section>
      </div>
      {dialogs}
    </div>
  );
}
