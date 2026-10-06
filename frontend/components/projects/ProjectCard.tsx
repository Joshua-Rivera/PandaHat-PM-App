import Link from "next/link";

import type { ProjectSummary } from "@/lib/api/types";
import { formatShortDate } from "@/lib/format";

import { Badge, ProgressBar, StageBadge } from "@/components/ui/Primitives";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const { stats } = project;
  return (
    <Link href={`/projects/${project.project_id}`} className="card project-card interactive">
      <div className="project-card-head">
        <h3>{project.name}</h3>
        {project.is_archived ? <Badge tone="muted">Archived</Badge> : <StageBadge stage={project.stage} />}
      </div>
      {project.description ? <p className="project-card-description">{project.description}</p> : null}
      <div className="project-card-progress">
        <ProgressBar percent={stats.progress_percent} label={`${project.name} progress`} />
        <span className="small muted">{stats.progress_percent}%</span>
      </div>
      <div className="project-card-meta">
        <span>{stats.member_count} researcher{stats.member_count === 1 ? "" : "s"}</span>
        <span>{stats.open_task_count} active task{stats.open_task_count === 1 ? "" : "s"}</span>
        {stats.blocked_task_count ? <span className="text-danger">{stats.blocked_task_count} blocked</span> : null}
        {stats.overdue_task_count ? <span className="text-warning">{stats.overdue_task_count} overdue</span> : null}
        {project.target_date ? <span>Target {formatShortDate(project.target_date)}</span> : null}
      </div>
    </Link>
  );
}
