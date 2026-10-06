"use client";

import Link from "next/link";
import { useState } from "react";

import { formatShortDate } from "@/lib/format";
import { useProjects, useUpdateProject } from "@/lib/queries";

import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ManagerOnly } from "@/components/shell/ManagerOnly";
import { serverErrors } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHeader, ProgressBar, StageBadge } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export default function ManageProjectsPage() {
  return (
    <ManagerOnly>
      <ManageProjects />
    </ManagerOnly>
  );
}

function ManageProjects() {
  const projects = useProjects(true);
  const update = useUpdateProject();
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <PageHeader
        title="Manage Projects"
        description="All projects, including archived ones."
        actions={
          <button type="button" className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New project
          </button>
        }
      />
      {projects.isPending ? (
        <TableSkeleton rows={5} columns={6} />
      ) : projects.isError ? (
        <ErrorState title="Couldn't load projects" error={projects.error} onRetry={() => projects.refetch()} />
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No projects yet"
          description="Create your first PandaHat research project to begin assigning researchers and tasks."
          action={<button type="button" className="btn primary" onClick={() => setCreating(true)}>Create project</button>}
        />
      ) : (
        <div className="card table-card">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Project</th>
                <th>Stage</th>
                <th>Manager</th>
                <th className="num">Researchers</th>
                <th className="num">Open tasks</th>
                <th>Progress</th>
                <th>Target</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {projects.data.map((p) => (
                <tr key={p.project_id} className={p.is_archived ? "is-muted" : undefined}>
                  <td data-label="Project">
                    <Link href={`/projects/${p.project_id}`}>{p.name}</Link>
                    {p.research_track ? <span className="muted small block">{p.research_track}</span> : null}
                  </td>
                  <td data-label="Stage">{p.is_archived ? <Badge tone="muted">Archived</Badge> : <StageBadge stage={p.stage} />}</td>
                  <td data-label="Manager">{p.project_manager?.display_name ?? "—"}</td>
                  <td data-label="Researchers" className="num">{p.stats.member_count}</td>
                  <td data-label="Open tasks" className="num">
                    {p.stats.open_task_count}
                    {p.stats.blocked_task_count ? <span className="text-danger small"> ({p.stats.blocked_task_count} blocked)</span> : null}
                  </td>
                  <td data-label="Progress" className="progress-cell">
                    <ProgressBar percent={p.stats.progress_percent} label={`${p.name} progress`} />
                    <span className="small muted">{p.stats.progress_percent}%</span>
                  </td>
                  <td data-label="Target">{formatShortDate(p.target_date)}</td>
                  <td data-label="Actions">
                    <button
                      type="button"
                      className="link-btn"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { id: p.project_id, body: { is_archived: !p.is_archived } },
                          {
                            onSuccess: () => toast.success(p.is_archived ? `${p.name} restored` : `${p.name} archived`),
                            onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't update the project"),
                          },
                        )
                      }
                    >
                      {p.is_archived ? "Restore" : "Archive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ProjectFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
