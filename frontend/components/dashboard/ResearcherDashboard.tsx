"use client";

import Link from "next/link";

import { formatDue, formatHours, formatShortDate, greeting, RESEARCH_STATUS_LABEL, STAGE_LABEL } from "@/lib/format";
import { useMyDashboard } from "@/lib/queries";

import { TaskList } from "@/components/tasks/TaskList";
import { Icon } from "@/components/ui/Icon";
import { CapacityBar, PageHeader, ProgressBar, SectionHeader, StatCard } from "@/components/ui/Primitives";
import { PageHeaderSkeleton, Skeleton, StatGridSkeleton, TaskListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

export function ResearcherDashboard() {
  const dashboard = useMyDashboard();

  if (dashboard.isPending) {
    return (
      <div className="page">
        <PageHeaderSkeleton />
        <StatGridSkeleton />
        <div className="dashboard-grid">
          <div className="card">
            <TaskListSkeleton />
          </div>
          <div className="card stack-md">
            <Skeleton width="50%" height={14} />
            <Skeleton height={8} />
            <Skeleton width="70%" height={12} />
          </div>
        </div>
      </div>
    );
  }
  if (dashboard.isError) {
    return <ErrorState title="Couldn't load your dashboard" error={dashboard.error} onRetry={() => dashboard.refetch()} />;
  }

  const d = dashboard.data;
  const firstName = d.display_name.split(" ")[0];
  const capacityTone = d.workload.capacity_state === "OVERLOADED" ? "danger" : d.workload.capacity_state === "AT_CAPACITY" ? "warning" : undefined;

  return (
    <div className="page">
      <PageHeader
        hero
        title={`${greeting()}, ${firstName}`}
        description={
          d.open_tasks.length
            ? `You have ${d.open_tasks.length} open task${d.open_tasks.length === 1 ? "" : "s"}${d.overdue_task_count ? `, ${d.overdue_task_count} overdue` : ""}.`
            : "Nothing assigned right now."
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Due this week"
          value={d.tasks_due_this_week}
          hint={d.overdue_task_count ? `${d.overdue_task_count} overdue` : "Next 7 days"}
          tone={d.overdue_task_count ? "danger" : undefined}
          href="/my-work"
        />
        <StatCard
          label="Research hours"
          value={`${formatHours(d.workload.assigned_hours)} / ${formatHours(d.workload.capacity_hours)}`}
          hint={
            !d.workload.capacity_hours ? (
              <Link href="/availability">Set your availability →</Link>
            ) : d.workload.below_commitment ? (
              <Link href="/availability">Below your {formatHours(d.workload.committed_hours)} commitment →</Link>
            ) : (
              `assigned of weekly availability · ${formatHours(d.workload.committed_hours)} committed`
            )
          }
          tone={capacityTone}
        />
        <StatCard
          label="Track"
          value={RESEARCH_STATUS_LABEL[d.research_status]}
          hint={d.learning ? `${d.learning.name} · ${d.learning.progress_percent}%` : undefined}
          href={d.learning ? "/learning" : undefined}
        />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <SectionHeader title="My tasks" action={<Link href="/my-work">View all</Link>} />
          {d.open_tasks.length || d.recently_completed_tasks.length ? (
            <TaskList tasks={[...d.open_tasks, ...d.recently_completed_tasks]} showAssignee={false} />
          ) : (
            <EmptyState
              icon="check"
              title="No tasks assigned"
              description="You're all caught up. New assignments will appear here and in your notifications."
              compact
            />
          )}
        </section>

        <div className="stack-lg">
          <section className="card">
            <SectionHeader title="Current project" />
            {d.current_project ? (
              <div className="stack-md">
                <Link href={`/projects/${d.current_project.project_id}`} className="current-project-name">
                  {d.current_project.name}
                </Link>
                <div className="kv">
                  <span className="muted">Current milestone</span>
                  <span>{STAGE_LABEL[d.current_project.stage]}</span>
                </div>
                <div className="stack-sm">
                  <div className="kv">
                    <span className="muted">Progress</span>
                    <span>{d.current_project.stats.progress_percent}%</span>
                  </div>
                  <ProgressBar percent={d.current_project.stats.progress_percent} label="Project progress" />
                </div>
              </div>
            ) : (
              <EmptyState icon="folder" title="No project yet" description="A project manager will add you to a project." compact />
            )}
          </section>

          <section className="card">
            <SectionHeader title="Capacity" action={<Link href="/availability">Edit availability</Link>} />
            <CapacityBar workload={d.workload} />
          </section>

          <section className="card">
            <SectionHeader title="Upcoming" />
            {d.upcoming.length ? (
              <ul className="upcoming-list">
                {d.upcoming.map((item, i) => (
                  <li key={i}>
                    <span className="upcoming-date">{item.kind === "task_deadline" ? formatDue(item.due) : formatShortDate(item.due)}</span>
                    {item.link ? <Link href={item.link}>{item.label}</Link> : <span>{item.label}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                <Icon name="calendar" size={12} /> No upcoming deadlines.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
