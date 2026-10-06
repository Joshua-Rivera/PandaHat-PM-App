"use client";

import { useState } from "react";

import { useProjects } from "@/lib/queries";

import { PmBoard } from "@/components/projects/PmBoard";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { useSession } from "@/components/shell/Session";
import { Icon } from "@/components/ui/Icon";
import { PageHeader, Tabs } from "@/components/ui/Primitives";
import { ProjectGridSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

export default function ProjectsPage() {
  const { me } = useSession();
  const projects = useProjects();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"projects" | "board">("projects");

  return (
    <div className="page">
      <PageHeader
        title="Projects"
        description={me.is_manager ? "Every active research project." : "Research projects you're a member of."}
        actions={
          me.is_manager ? (
            <button type="button" className="btn primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> New project
            </button>
          ) : null
        }
      />
      {me.is_manager ? (
        <Tabs
          label="Projects view"
          tabs={[
            { value: "projects", label: "Projects" },
            { value: "board", label: "Board" },
          ]}
          value={view}
          onChange={setView}
        />
      ) : null}
      {me.is_manager && view === "board" ? (
        <PmBoard />
      ) : projects.isPending ? (
        <ProjectGridSkeleton count={4} />
      ) : projects.isError ? (
        <ErrorState title="Couldn't load projects" error={projects.error} onRetry={() => projects.refetch()} />
      ) : projects.data.length === 0 ? (
        me.is_manager ? (
          <EmptyState
            icon="folder"
            title="No projects yet"
            description="Create your first PandaHat research project to begin assigning researchers and tasks."
            action={
              <button type="button" className="btn primary" onClick={() => setCreating(true)}>
                Create project
              </button>
            }
          />
        ) : (
          <EmptyState icon="folder" title="You're not on a project yet" description="A project manager will add you to a project, and you'll get a notification when they do." />
        )
      ) : (
        <div className="project-grid">
          {projects.data.map((p) => (
            <ProjectCard key={p.project_id} project={p} />
          ))}
        </div>
      )}
      <ProjectFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
