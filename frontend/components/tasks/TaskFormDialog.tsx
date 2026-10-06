"use client";

import { useState, type FormEvent } from "react";

import type { Task, TaskInput, TaskPriority, TaskStatus } from "@/lib/api/types";
import { dateInputToDeadline, deadlineToDateInput } from "@/lib/format";
import { useArchiveTask, useCreateTask, useProjects, useResearchers, useUpdateTask } from "@/lib/queries";

import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, parseList, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

import { PrioritySelector, ProjectSelector, ResearcherSelector, StatusSelector } from "./Selectors";

type FormState = {
  title: string;
  description: string;
  project_id: string;
  assignee_user_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimated_hours: string;
  due_date: string;
  required_skills: string;
  github_issue_url: string;
};

function initialState(task: Task | null, defaults: Partial<FormState>): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    project_id: task?.project_id ?? defaults.project_id ?? "",
    assignee_user_id: task?.assignee_user_id ?? defaults.assignee_user_id ?? "",
    status: task?.status ?? "TODO",
    priority: task?.priority ?? "MEDIUM",
    estimated_hours: task?.estimated_hours != null ? String(task.estimated_hours) : "",
    due_date: deadlineToDateInput(task?.deadline_at ?? null),
    required_skills: task?.required_skills.join(", ") ?? "",
    github_issue_url: task?.github_issue_url ?? "",
  };
}

function toInput(form: FormState): TaskInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    project_id: form.project_id,
    assignee_user_id: form.assignee_user_id || null,
    status: form.status,
    priority: form.priority,
    estimated_hours: form.estimated_hours === "" ? null : Number(form.estimated_hours),
    deadline_at: dateInputToDeadline(form.due_date),
    required_skills: parseList(form.required_skills),
    github_issue_url: form.github_issue_url.trim() || null,
  };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title.trim()) errors.title = "Give the task a title.";
  if (!form.project_id) errors.project_id = "Choose the project this task belongs to.";
  if (form.estimated_hours !== "") {
    const hours = Number(form.estimated_hours);
    if (Number.isNaN(hours) || hours < 0 || hours > 999) errors.estimated_hours = "Enter hours between 0 and 999.";
  }
  if (form.github_issue_url.trim() && !/^https:\/\/github\.com\/\S+$/.test(form.github_issue_url.trim())) {
    errors.github_issue_url = "Use a link like https://github.com/org/repo/issues/12";
  }
  return errors;
}

/** Only send what changed, so e.g. saving without touching the deadline doesn't notify anyone. */
function diff(before: TaskInput, after: TaskInput): Partial<TaskInput> {
  const changes: Partial<TaskInput> = {};
  for (const key of Object.keys(after) as (keyof TaskInput)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      (changes as Record<string, unknown>)[key] = after[key];
    }
  }
  return changes;
}

export function TaskFormDialog({
  open,
  onClose,
  task = null,
  defaults = {},
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaults?: { project_id?: string; assignee_user_id?: string };
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      description={task ? task.project_name : "Create a task and optionally assign it to a researcher."}
      wide
    >
      {/* Remount the form each time the dialog opens so it starts from fresh values. */}
      {open ? <TaskForm task={task} defaults={defaults} onDone={onClose} /> : null}
    </Dialog>
  );
}

function TaskForm({ task, defaults, onDone }: { task: Task | null; defaults: Partial<FormState>; onDone: () => void }) {
  const [form, setForm] = useState(() => initialState(task, defaults));
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [confirmArchive, setConfirmArchive] = useState(false);
  const projects = useProjects();
  const researchers = useResearchers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const toast = useToast();
  const mutation = task ? updateTask : createTask;
  const server = mutation.isError ? serverErrors(mutation.error) : { fields: {} as FieldErrors, form: null };
  const errors = { ...server.fields, ...clientErrors };
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setClientErrors((e) => ({ ...e, [key]: "" }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setClientErrors(found);
    if (Object.keys(found).length) return;
    const input = toInput(form);
    if (task) {
      const changes = diff(toInput(initialState(task, {})), input);
      if (Object.keys(changes).length === 0) return onDone();
      updateTask.mutate(
        { id: task.task_id, body: changes },
        { onSuccess: () => (toast.success("Task updated"), onDone()) },
      );
    } else {
      createTask.mutate(input, {
        onSuccess: (created) => {
          toast.success(created.assignee ? `Task created and assigned to ${created.assignee.display_name}` : "Task created");
          onDone();
        },
      });
    }
  };

  const archive = () => {
    if (!task) return;
    if (!confirmArchive) return setConfirmArchive(true);
    archiveTask.mutate(task.task_id, {
      onSuccess: () => (toast.success("Task archived"), onDone()),
      onError: (error) => toast.error(serverErrors(error).form ?? "Couldn't archive the task"),
    });
  };

  if (projects.isPending || researchers.isPending) {
    return (
      <div className="stack-md">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={36} />
        ))}
      </div>
    );
  }
  const projectOptions = (projects.data ?? []).filter((p) => !p.is_archived);
  const hours = form.estimated_hours === "" ? 0 : Number(form.estimated_hours) || 0;
  const extraHours = task && task.assignee_user_id === form.assignee_user_id ? 0 : hours;

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Title" htmlFor="task-title" required error={errors.title}>
        <input
          id="task-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Analyze SimSwap results"
          autoFocus
          aria-invalid={!!errors.title || undefined}
        />
      </Field>
      <Field label="Description" htmlFor="task-description" error={errors.description}>
        <textarea
          id="task-description"
          rows={3}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What does done look like? Link datasets, papers or notebooks."
        />
      </Field>
      <div className="form-grid">
        <Field label="Project" htmlFor="task-project" required error={errors.project_id}>
          <ProjectSelector id="task-project" value={form.project_id} onChange={(v) => set("project_id", v)} projects={projectOptions} invalid={!!errors.project_id} />
        </Field>
        <Field label="Assignee" htmlFor="task-assignee" error={errors.assignee_user_id} hint="They'll be notified and added to the project.">
          <ResearcherSelector
            id="task-assignee"
            value={form.assignee_user_id}
            onChange={(v) => set("assignee_user_id", v)}
            researchers={researchers.data ?? []}
            extraHours={form.assignee_user_id ? extraHours : 0}
          />
        </Field>
        <Field label="Status" htmlFor="task-status">
          <StatusSelector id="task-status" value={form.status} onChange={(v) => set("status", v)} />
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <PrioritySelector id="task-priority" value={form.priority} onChange={(v) => set("priority", v)} />
        </Field>
        <Field label="Estimated hours" htmlFor="task-hours" error={errors.estimated_hours}>
          <input
            id="task-hours"
            type="number"
            min={0}
            max={999}
            step={0.5}
            inputMode="decimal"
            value={form.estimated_hours}
            onChange={(e) => set("estimated_hours", e.target.value)}
            placeholder="3"
          />
        </Field>
        <Field label="Due date" htmlFor="task-due" error={errors.deadline_at}>
          <input id="task-due" type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </Field>
        <Field label="Required skills" htmlFor="task-skills" hint="Comma-separated" error={errors.required_skills}>
          <input id="task-skills" value={form.required_skills} onChange={(e) => set("required_skills", e.target.value)} placeholder="PyTorch, Face swapping" />
        </Field>
        <Field label="GitHub issue" htmlFor="task-github" hint="Optional. Links this task to GitHub." error={errors.github_issue_url}>
          <input
            id="task-github"
            type="url"
            value={form.github_issue_url}
            onChange={(e) => set("github_issue_url", e.target.value)}
            placeholder="https://github.com/org/repo/issues/12"
          />
        </Field>
      </div>
      <FormError message={server.form} />
      <div className="form-footer">
        {task ? (
          <button type="button" className="btn danger-ghost" onClick={archive} disabled={archiveTask.isPending}>
            {archiveTask.isPending ? "Archiving…" : confirmArchive ? "Click again to archive" : "Archive task"}
          </button>
        ) : (
          <span />
        )}
        <FormActions
          onCancel={onDone}
          submitting={mutation.isPending}
          submitLabel={task ? "Save changes" : "Create task"}
          submittingLabel={task ? "Saving…" : "Creating…"}
        />
      </div>
    </form>
  );
}
