"use client";

import type { LearningProgress } from "@/lib/api/types";
import { formatHours, formatShortDate } from "@/lib/format";
import { useSetLearningTaskCompletion } from "@/lib/queries";

import { serverErrors } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/Toast";

/** A researcher's path: module checklist with progress. Editable only by the researcher themselves. */
export function LearningProgressView({ progress, editable }: { progress: LearningProgress; editable: boolean }) {
  const setCompletion = useSetLearningTaskCompletion();
  const toast = useToast();
  const current = progress.current_task;

  const toggle = (id: string, done: boolean, title: string) =>
    setCompletion.mutate(
      { id, done },
      {
        onSuccess: (data) => {
          if (done && data.enrollment?.completed_at) toast.success("Learning path complete! Your PM has been notified.");
          else toast.success(done ? `Completed "${title}"` : `Reopened "${title}"`);
        },
        onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't update progress"),
      },
    );

  return (
    <div className="stack-lg">
      <section className="card stack-md">
        <div className="row space-between wrap gap-sm">
          <div>
            <h2 className="h-lg">{progress.name}</h2>
            {progress.description ? <p className="muted">{progress.description}</p> : null}
          </div>
          <span className="big-number">{progress.progress_percent}%</span>
        </div>
        <ProgressBar percent={progress.progress_percent} tone={progress.completed_at ? "success" : undefined} label="Learning path progress" />
        <p className="muted small">
          {progress.completed_task_count} of {progress.total_task_count} tasks complete
          {progress.target_date ? ` · target ${formatShortDate(progress.target_date)}` : ""}
          {progress.completed_at ? ` · finished ${formatShortDate(progress.completed_at)}` : ""}
        </p>
      </section>

      {current ? (
        <section className="card current-task">
          <span className="eyebrow">Current task · {current.module_title}</span>
          <h3>{current.title}</h3>
          {current.description ? <p className="muted">{current.description}</p> : null}
          <div className="row gap-md wrap">
            {current.estimated_hours != null ? <span className="muted small">Estimated time: {formatHours(current.estimated_hours)}</span> : null}
            {current.resource_url ? (
              <a href={current.resource_url} target="_blank" rel="noreferrer" className="btn">
                View resource <Icon name="external" size={12} />
              </a>
            ) : null}
            {editable ? (
              <button
                type="button"
                className="btn primary"
                disabled={setCompletion.isPending}
                onClick={() => toggle(current.learning_task_id, true, current.title)}
              >
                Mark complete
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <ol className="module-list">
        {progress.modules.map((module) => (
          <li key={module.learning_module_id} className={`module module-${module.state.toLowerCase()}`}>
            <div className="module-head">
              <span className="module-marker" aria-hidden="true">
                {module.state === "COMPLETED" ? <Icon name="check" size={12} /> : module.state === "IN_PROGRESS" ? <span className="half" /> : null}
              </span>
              <strong className="grow">{module.title}</strong>
              <span className="muted small">
                {module.completed_task_count} / {module.total_task_count} tasks
              </span>
            </div>
            <ul className="module-tasks">
              {module.tasks.map((task) => (
                <li key={task.learning_task_id}>
                  <label className={`checkbox${task.is_completed ? " done" : ""}`}>
                    <input
                      type="checkbox"
                      checked={task.is_completed}
                      disabled={!editable || setCompletion.isPending}
                      onChange={(e) => toggle(task.learning_task_id, e.target.checked, task.title)}
                    />
                    <span>{task.title}</span>
                  </label>
                  <span className="module-task-meta">
                    {task.estimated_hours != null ? formatHours(task.estimated_hours) : null}
                    {task.resource_url ? (
                      <a href={task.resource_url} target="_blank" rel="noreferrer" aria-label={`Resource for ${task.title}`}>
                        <Icon name="external" size={12} />
                      </a>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
