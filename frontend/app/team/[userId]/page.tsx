"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import type { Commitment, ResearchStatus, Task } from "@/lib/api/types";
import { COMMITMENT_HOURS, COMMITMENT_LABEL, COMMITMENTS, RESEARCH_STATUS_LABEL, RESEARCH_STATUSES, ROLE_LABEL } from "@/lib/format";
import { useResearcher, useUpdateResearcher } from "@/lib/queries";

import { AvailabilitySummary } from "@/components/availability/AvailabilitySummary";
import { AssignLearningPathDialog } from "@/components/learning/AssignLearningPathDialog";
import { LearningProgressView } from "@/components/learning/LearningProgressView";
import { ManagerOnly } from "@/components/shell/ManagerOnly";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { serverErrors } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Avatar, Badge, CapacityBar, PageHeader, SectionHeader, Tabs } from "@/components/ui/Primitives";
import { PageHeaderSkeleton, StatGridSkeleton, TaskListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

type Tab = "profile" | "work" | "learning" | "availability";

export default function ResearcherPage() {
  return (
    <ManagerOnly>
      <Researcher />
    </ManagerOnly>
  );
}

function Researcher() {
  const { userId } = useParams<{ userId: string }>();
  const detail = useResearcher(userId);
  const update = useUpdateResearcher();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("profile");
  const [dialog, setDialog] = useState<"task" | "learning" | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  if (detail.isPending) {
    return (
      <div className="page">
        <PageHeaderSkeleton />
        <StatGridSkeleton />
        <div className="card">
          <TaskListSkeleton />
        </div>
      </div>
    );
  }
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return <NotFoundState what="Researcher" backHref="/team" backLabel="Back to team" />;
    }
    return <ErrorState title="Couldn't load this researcher" error={detail.error} onRetry={() => detail.refetch()} />;
  }

  const { researcher: r, availability, open_tasks, recently_completed_tasks, projects, learning } = detail.data;
  const setStatus = (status: ResearchStatus) =>
    update.mutate(
      { id: r.user_id, body: { research_status: status } },
      {
        onSuccess: () =>
          toast.success(
            status === "RESEARCH" ? `${r.display_name} moved to Research and has been notified` : `Track set to ${RESEARCH_STATUS_LABEL[status]}`,
          ),
        onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't update track"),
      },
    );
  const setCommitment = (commitment: Commitment) =>
    update.mutate(
      { id: r.user_id, body: { commitment } },
      {
        onSuccess: () => toast.success(`${r.display_name} is now a ${COMMITMENT_LABEL[commitment].toLowerCase()} (${COMMITMENT_HOURS[commitment]}h/week)`),
        onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't update commitment"),
      },
    );

  return (
    <div className="page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/team">Team</Link> <Icon name="chevronRight" size={12} /> <span>{r.display_name}</span>
      </nav>
      <div className="profile-header">
        <Avatar name={r.display_name} size={56} />
        <div className="grow">
          <PageHeader title={r.display_name} description={`${ROLE_LABEL[r.role]} · ${r.email}`} />
        </div>
        <div className="page-actions">
          <label className="inline-field">
            <span className="muted small">Track</span>
            <select value={r.research_status} disabled={update.isPending} onChange={(e) => setStatus(e.target.value as ResearchStatus)}>
              {RESEARCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RESEARCH_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span className="muted small">Commitment</span>
            <select value={r.commitment} disabled={update.isPending} onChange={(e) => setCommitment(e.target.value as Commitment)}>
              {COMMITMENTS.map((c) => (
                <option key={c} value={c}>
                  {COMMITMENT_LABEL[c]} · {COMMITMENT_HOURS[c]}h
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn primary" onClick={() => setDialog("task")}>
            <Icon name="plus" /> Assign task
          </button>
        </div>
      </div>

      <Tabs<Tab>
        label="Researcher sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "profile", label: "Profile" },
          { value: "work", label: "Workload", count: open_tasks.length },
          { value: "learning", label: "Learning Path" },
          { value: "availability", label: "Availability" },
        ]}
      />

      {tab === "profile" ? (
        <div className="dashboard-grid">
          <section className="card stack-md">
            <SectionHeader title="Current workload" />
            <CapacityBar workload={r.workload} />
            <SectionHeader title="Skills" />
            {r.skills.length ? (
              <div className="row gap-sm wrap">
                {r.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            ) : (
              <p className="muted small">No skills listed. Researchers can add them in Settings.</p>
            )}
          </section>
          <section className="card">
            <SectionHeader title="Projects" />
            {projects.length ? (
              <ul className="simple-list">
                {projects.map((p) => (
                  <li key={p.project_id}>
                    <Link href={`/projects/${p.project_id}`}>{p.name}</Link>
                    <span className="muted small">{p.stats.progress_percent}% complete</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="folder" title="Not on any project" description="Assign a task or add them from a project's Researchers tab." compact />
            )}
            <SectionHeader title="Recently completed" />
            {recently_completed_tasks.length ? (
              <TaskList tasks={recently_completed_tasks} showAssignee={false} />
            ) : (
              <p className="muted small">Nothing completed yet.</p>
            )}
          </section>
        </div>
      ) : tab === "work" ? (
        <section className="card">
          <SectionHeader title="Open tasks" />
          {open_tasks.length ? (
            <TaskList tasks={open_tasks} showAssignee={false} onEdit={setEditingTask} />
          ) : (
            <EmptyState
              icon="work"
              title="No open tasks"
              description={`${r.display_name} has capacity for new work.`}
              action={<button type="button" className="btn primary" onClick={() => setDialog("task")}>Assign task</button>}
              compact
            />
          )}
        </section>
      ) : tab === "learning" ? (
        learning ? (
          <div className="stack-md">
            <div className="row space-between">
              <span />
              <button type="button" className="btn" onClick={() => setDialog("learning")}>
                Change learning path
              </button>
            </div>
            <LearningProgressView progress={learning} editable={false} />
          </div>
        ) : (
          <EmptyState
            icon="book"
            title="No learning path assigned"
            description="Assign a learning path to onboard this researcher."
            action={<button type="button" className="btn primary" onClick={() => setDialog("learning")}>Assign learning path</button>}
          />
        )
      ) : (
        <section className="card stack-md">
          <SectionHeader title={`Weekly availability · ${availability.weekly_capacity_hours}h`} />
          {availability.blocks.length ? (
            <AvailabilitySummary blocks={availability.blocks} />
          ) : (
            <EmptyState icon="clock" title="No availability entered" description={`${r.display_name} hasn't entered their weekly availability yet.`} compact />
          )}
        </section>
      )}

      <TaskFormDialog open={dialog === "task"} onClose={() => setDialog(null)} defaults={{ assignee_user_id: r.user_id }} />
      <TaskFormDialog open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
      <AssignLearningPathDialog open={dialog === "learning"} onClose={() => setDialog(null)} researcherId={r.user_id} />
    </div>
  );
}
