"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { ProjectDetail, ProjectInput, ProjectStage } from "@/lib/api/types";
import { STAGE_LABEL, STAGES } from "@/lib/format";
import { useCreateProject, useUpdateProject, useUsers } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

type FormState = Record<keyof ProjectInput, string>;

const TRACK_SUGGESTIONS = ["Watermarking", "Detection", "Forensics", "Robustness", "Learning Path"];

function initial(project: ProjectDetail | null, currentUserId: string): FormState {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    research_question: project?.research_question ?? "",
    hypothesis: project?.hypothesis ?? "",
    research_track: project?.research_track ?? "",
    stage: project?.stage ?? "PLANNING",
    project_manager_user_id: project ? (project.project_manager?.user_id ?? "") : currentUserId,
    research_lead_user_id: project?.research_lead?.user_id ?? "",
    start_date: project?.start_date ?? "",
    target_date: project?.target_date ?? "",
    github_repository: project?.github_repository ?? "",
    github_project_url: project?.github_project_url ?? "",
  };
}

function toInput(form: FormState): ProjectInput {
  const orNull = (v: string) => v.trim() || null;
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    research_question: form.research_question.trim(),
    hypothesis: form.hypothesis.trim(),
    research_track: form.research_track.trim(),
    stage: form.stage as ProjectStage,
    project_manager_user_id: orNull(form.project_manager_user_id),
    research_lead_user_id: orNull(form.research_lead_user_id),
    start_date: orNull(form.start_date),
    target_date: orNull(form.target_date),
    github_repository: orNull(form.github_repository),
    github_project_url: orNull(form.github_project_url),
  };
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Give the project a name.";
  if (form.start_date && form.target_date && form.target_date < form.start_date) {
    errors.target_date = "Target date must be on or after the start date.";
  }
  if (form.github_repository.trim() && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(form.github_repository.trim())) {
    errors.github_repository = "Use the owner/repository form, e.g. Adversarial-Fall-2026/Watermarking";
  }
  if (form.github_project_url.trim() && !/^https:\/\/github\.com\/\S+$/.test(form.github_project_url.trim())) {
    errors.github_project_url = "Use a https://github.com/… link";
  }
  return errors;
}

export function ProjectFormDialog({ open, onClose, project = null }: { open: boolean; onClose: () => void; project?: ProjectDetail | null }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New research project"}
      description={project ? project.name : "Researchers and tasks can be added once the project exists."}
      wide
    >
      {open ? <ProjectForm project={project} onDone={onClose} /> : null}
    </Dialog>
  );
}

function ProjectForm({ project, onDone }: { project: ProjectDetail | null; onDone: () => void }) {
  const { me } = useSession();
  const [form, setForm] = useState(() => initial(project, me.user_id));
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const users = useUsers();
  const create = useCreateProject();
  const update = useUpdateProject();
  const toast = useToast();
  const router = useRouter();
  const mutation = project ? update : create;
  const server = mutation.isError ? serverErrors(mutation.error) : { fields: {} as FieldErrors, form: null };
  const errors = { ...server.fields, ...clientErrors };
  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setClientErrors((e) => ({ ...e, [key]: "" }));
  };
  const managers = (users.data ?? []).filter((u) => u.role !== "researcher");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setClientErrors(found);
    if (Object.keys(found).length) return;
    if (project) {
      update.mutate(
        { id: project.project_id, body: toInput(form) },
        { onSuccess: () => (toast.success("Project updated"), onDone()) },
      );
    } else {
      create.mutate(toInput(form), {
        onSuccess: (created) => {
          toast.success(`Project "${created.name}" created`);
          onDone();
          router.push(`/projects/${created.project_id}`);
        },
      });
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Project name" htmlFor="project-name" required error={errors.name}>
        <input
          id="project-name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Watermark Robustness Against Face Swaps"
          autoFocus
          aria-invalid={!!errors.name || undefined}
        />
      </Field>
      <Field label="Description" htmlFor="project-description" error={errors.description}>
        <textarea id="project-description" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="One or two sentences on what this project is about." />
      </Field>
      <div className="form-grid">
        <Field label="Research question" htmlFor="project-question" error={errors.research_question}>
          <textarea id="project-question" rows={2} value={form.research_question} onChange={(e) => set("research_question", e.target.value)} placeholder="Can TrustMark survive face-swap manipulation?" />
        </Field>
        <Field label="Hypothesis" htmlFor="project-hypothesis" error={errors.hypothesis}>
          <textarea id="project-hypothesis" rows={2} value={form.hypothesis} onChange={(e) => set("hypothesis", e.target.value)} placeholder="What do you expect to find?" />
        </Field>
        <Field label="Research track" htmlFor="project-track" error={errors.research_track}>
          <input id="project-track" list="track-suggestions" value={form.research_track} onChange={(e) => set("research_track", e.target.value)} placeholder="Watermarking" />
          <datalist id="track-suggestions">
            {TRACK_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Stage" htmlFor="project-stage">
          <select id="project-stage" value={form.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project manager" htmlFor="project-pm" error={errors.project_manager_user_id}>
          <select id="project-pm" value={form.project_manager_user_id} onChange={(e) => set("project_manager_user_id", e.target.value)} disabled={users.isPending}>
            <option value="">No project manager</option>
            {managers.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Research lead" htmlFor="project-lead" error={errors.research_lead_user_id}>
          <select id="project-lead" value={form.research_lead_user_id} onChange={(e) => set("research_lead_user_id", e.target.value)} disabled={users.isPending}>
            <option value="">No research lead</option>
            {(users.data ?? []).map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date" htmlFor="project-start" error={errors.start_date}>
          <input id="project-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </Field>
        <Field label="Target date" htmlFor="project-target" error={errors.target_date}>
          <input id="project-target" type="date" value={form.target_date} onChange={(e) => set("target_date", e.target.value)} />
        </Field>
        <Field label="GitHub repository" htmlFor="project-repo" hint="owner/repository" error={errors.github_repository}>
          <input id="project-repo" value={form.github_repository} onChange={(e) => set("github_repository", e.target.value)} placeholder="Adversarial-Fall-2026/Watermarking-And-Deepfakes" />
        </Field>
        <Field label="GitHub project" htmlFor="project-gh-project" hint="Optional project board link" error={errors.github_project_url}>
          <input id="project-gh-project" type="url" value={form.github_project_url} onChange={(e) => set("github_project_url", e.target.value)} placeholder="https://github.com/orgs/…/projects/1" />
        </Field>
      </div>
      <FormError message={server.form} />
      <FormActions
        onCancel={onDone}
        submitting={mutation.isPending}
        submitLabel={project ? "Save changes" : "Create project"}
        submittingLabel={project ? "Saving…" : "Creating…"}
      />
    </form>
  );
}
