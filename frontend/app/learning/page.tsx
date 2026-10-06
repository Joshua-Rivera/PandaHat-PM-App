"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useLearningPath, useLearningPaths } from "@/lib/queries";

import { AssignLearningPathDialog } from "@/components/learning/AssignLearningPathDialog";
import { AddModuleDialog, CreateLearningPathDialog } from "@/components/learning/LearningPathBuilder";
import { useSession } from "@/components/shell/Session";
import { Icon } from "@/components/ui/Icon";
import { Avatar, PageHeader, ProgressBar, SectionHeader } from "@/components/ui/Primitives";
import { PageHeaderSkeleton, ProjectGridSkeleton, TaskListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { formatShortDate } from "@/lib/format";

export default function LearningPage() {
  const { me } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!me.is_manager) router.replace("/my-work#learning");
  }, [me.is_manager, router]);
  return me.is_manager ? <ManageLearning /> : null;
}

function ManageLearning() {
  const paths = useLearningPaths();
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"create" | "assign" | "module" | null>(null);
  const selectedId = selected ?? paths.data?.[0]?.learning_path_id ?? null;

  return (
    <div className="page">
      <PageHeader
        title="Learning Paths"
        description="Onboarding curricula for researchers on the Learning Path."
        actions={
          <>
            <button type="button" className="btn" onClick={() => setDialog("assign")} disabled={!paths.data?.length}>
              Assign to researcher
            </button>
            <button type="button" className="btn primary" onClick={() => setDialog("create")}>
              <Icon name="plus" /> New learning path
            </button>
          </>
        }
      />
      {paths.isPending ? (
        <>
          <PageHeaderSkeleton />
          <ProjectGridSkeleton count={2} />
        </>
      ) : paths.isError ? (
        <ErrorState title="Couldn't load learning paths" error={paths.error} onRetry={() => paths.refetch()} />
      ) : paths.data.length === 0 ? (
        <EmptyState
          icon="book"
          title="No learning paths yet"
          description="Create a learning path (modules and tasks) and assign it to new researchers."
          action={<button type="button" className="btn primary" onClick={() => setDialog("create")}>Create learning path</button>}
        />
      ) : (
        <div className="split">
          <ul className="path-list" aria-label="Learning paths">
            {paths.data.map((p) => (
              <li key={p.learning_path_id}>
                <button
                  type="button"
                  className={`path-item${p.learning_path_id === selectedId ? " active" : ""}`}
                  onClick={() => setSelected(p.learning_path_id)}
                  aria-pressed={p.learning_path_id === selectedId}
                >
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {p.module_count} modules · {p.task_count} tasks · {p.enrolled_count} enrolled
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selectedId ? <PathDetail id={selectedId} onAddModule={() => setDialog("module")} onAssign={() => setDialog("assign")} /> : null}
        </div>
      )}
      <CreateLearningPathDialog open={dialog === "create"} onClose={() => setDialog(null)} onCreated={setSelected} />
      <AssignLearningPathDialog open={dialog === "assign"} onClose={() => setDialog(null)} learningPathId={selectedId ?? undefined} />
      {selectedId ? <AddModuleDialog open={dialog === "module"} onClose={() => setDialog(null)} learningPathId={selectedId} /> : null}
    </div>
  );
}

function PathDetail({ id, onAddModule, onAssign }: { id: string; onAddModule: () => void; onAssign: () => void }) {
  const path = useLearningPath(id);
  if (path.isPending) return <div className="card"><TaskListSkeleton rows={4} /></div>;
  if (path.isError) return <ErrorState title="Couldn't load this learning path" error={path.error} onRetry={() => path.refetch()} />;
  const p = path.data;
  return (
    <div className="stack-lg">
      <section className="card">
        <SectionHeader title={`Researchers on ${p.name}`} action={<button type="button" className="btn" onClick={onAssign}>Assign</button>} />
        {p.enrollments.length ? (
          <ul className="capacity-list">
            {p.enrollments.map((e) => (
              <li key={e.researcher.user_id}>
                <Link href={`/team/${e.researcher.user_id}`} className="capacity-person">
                  <Avatar name={e.researcher.display_name} size={24} />
                  <span>{e.researcher.display_name}</span>
                </Link>
                <div className="capacity">
                  <ProgressBar percent={e.progress_percent} tone={e.completed_at ? "success" : undefined} label={`${e.researcher.display_name} progress`} />
                  <div className="capacity-meta">
                    <span>{e.progress_percent}%</span>
                    <span className="muted small">
                      {e.completed_at ? "Completed" : e.target_date ? `Target ${formatShortDate(e.target_date)}` : ""}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="users" title="Nobody is on this path yet" action={<button type="button" className="btn primary" onClick={onAssign}>Assign to researcher</button>} compact />
        )}
      </section>
      <section className="card">
        <SectionHeader title={`Modules · ${p.total_task_count} tasks`} action={<button type="button" className="btn ghost" onClick={onAddModule}><Icon name="plus" /> Add module</button>} />
        <ol className="module-list plain">
          {p.modules.map((m) => (
            <li key={m.learning_module_id} className="module">
              <div className="module-head">
                <span className="module-number">{m.position + 1}</span>
                <strong className="grow">{m.title}</strong>
                <span className="muted small">{m.total_task_count} tasks</span>
              </div>
              <ul className="module-tasks">
                {m.tasks.map((t) => (
                  <li key={t.learning_task_id}>
                    <span>{t.title}</span>
                    {t.resource_url ? (
                      <a href={t.resource_url} target="_blank" rel="noreferrer" aria-label={`Resource for ${t.title}`}>
                        <Icon name="external" size={12} />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
