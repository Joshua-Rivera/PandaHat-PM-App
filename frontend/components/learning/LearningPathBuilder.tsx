"use client";

import { useState, type FormEvent } from "react";

import type { LearningModuleInput } from "@/lib/api/types";
import { useAddLearningModule, useCreateLearningPath } from "@/lib/queries";

import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

type TaskDraft = { title: string; resource_url: string; estimated_hours: string };
type ModuleDraft = { title: string; tasks: TaskDraft[] };

const emptyTask = (): TaskDraft => ({ title: "", resource_url: "", estimated_hours: "" });
const emptyModule = (): ModuleDraft => ({ title: "", tasks: [emptyTask()] });

function validateModules(modules: ModuleDraft[]): FieldErrors {
  const errors: FieldErrors = {};
  modules.forEach((m, mi) => {
    if (!m.title.trim()) errors[`m${mi}`] = "Name this module.";
    m.tasks.forEach((t, ti) => {
      if (!t.title.trim()) errors[`m${mi}t${ti}`] = "Task title is required.";
      else if (t.resource_url.trim() && !/^https?:\/\/\S+$/.test(t.resource_url.trim())) errors[`m${mi}t${ti}`] = "Resource must be a http(s) link.";
    });
  });
  return errors;
}

const toInput = (modules: ModuleDraft[]): LearningModuleInput[] =>
  modules.map((m) => ({
    title: m.title.trim(),
    tasks: m.tasks.map((t) => ({
      title: t.title.trim(),
      description: "",
      resource_url: t.resource_url.trim() || null,
      estimated_hours: t.estimated_hours === "" ? null : Number(t.estimated_hours),
    })),
  }));

function ModulesEditor({ modules, onChange, errors }: { modules: ModuleDraft[]; onChange: (m: ModuleDraft[]) => void; errors: FieldErrors }) {
  const setModule = (mi: number, patch: Partial<ModuleDraft>) => onChange(modules.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  const setTask = (mi: number, ti: number, patch: Partial<TaskDraft>) =>
    setModule(mi, { tasks: modules[mi].tasks.map((t, i) => (i === ti ? { ...t, ...patch } : t)) });

  return (
    <div className="stack-md">
      {modules.map((module, mi) => (
        <fieldset key={mi} className="module-editor">
          <legend className="sr-only">Module {mi + 1}</legend>
          <div className="row gap-sm">
            <span className="module-number">{mi + 1}</span>
            <input
              className="grow"
              value={module.title}
              onChange={(e) => setModule(mi, { title: e.target.value })}
              placeholder="Module name, e.g. PyTorch Fundamentals"
              aria-label={`Module ${mi + 1} name`}
              aria-invalid={!!errors[`m${mi}`] || undefined}
            />
            {modules.length > 1 ? (
              <button type="button" className="icon-btn" aria-label={`Remove module ${mi + 1}`} onClick={() => onChange(modules.filter((_, i) => i !== mi))}>
                <Icon name="trash" size={14} />
              </button>
            ) : null}
          </div>
          {errors[`m${mi}`] ? <p className="field-error">{errors[`m${mi}`]}</p> : null}
          <ul className="task-editor-list">
            {module.tasks.map((task, ti) => (
              <li key={ti} className="stack-xs">
                <div className="task-editor-row">
                  <input value={task.title} onChange={(e) => setTask(mi, ti, { title: e.target.value })} placeholder="Task, e.g. Read TrustMark paper" aria-label={`Module ${mi + 1} task ${ti + 1} title`} />
                  <input value={task.resource_url} onChange={(e) => setTask(mi, ti, { resource_url: e.target.value })} placeholder="Resource link (optional)" aria-label={`Module ${mi + 1} task ${ti + 1} resource`} />
                  <input type="number" min={0} step={0.5} value={task.estimated_hours} onChange={(e) => setTask(mi, ti, { estimated_hours: e.target.value })} placeholder="Hours" aria-label={`Module ${mi + 1} task ${ti + 1} hours`} />
                  {module.tasks.length > 1 ? (
                    <button type="button" className="icon-btn" aria-label={`Remove task ${ti + 1}`} onClick={() => setModule(mi, { tasks: module.tasks.filter((_, i) => i !== ti) })}>
                      <Icon name="close" size={14} />
                    </button>
                  ) : null}
                </div>
                {errors[`m${mi}t${ti}`] ? <p className="field-error">{errors[`m${mi}t${ti}`]}</p> : null}
              </li>
            ))}
          </ul>
          <button type="button" className="link-btn" onClick={() => setModule(mi, { tasks: [...module.tasks, emptyTask()] })}>
            <Icon name="plus" size={12} /> Add task
          </button>
        </fieldset>
      ))}
    </div>
  );
}

export function CreateLearningPathDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="New learning path" description="Modules are completed in order; each has one or more tasks." wide>
      {open ? <CreateForm onDone={onClose} onCreated={onCreated} /> : null}
    </Dialog>
  );
}

function CreateForm({ onDone, onCreated }: { onDone: () => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState<ModuleDraft[]>([emptyModule()]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateLearningPath();
  const toast = useToast();
  const server = create.isError ? serverErrors(create.error) : { fields: {} as FieldErrors, form: null };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateModules(modules);
    if (!name.trim()) found.name = "Name the learning path.";
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate(
      { name: name.trim(), description: description.trim(), modules: toInput(modules) },
      {
        onSuccess: (path) => {
          toast.success(`Learning path "${path.name}" created`);
          onCreated?.(path.learning_path_id);
          onDone();
        },
      },
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Name" htmlFor="lp-name" required error={errors.name ?? server.fields.name}>
        <input id="lp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Computer Vision Foundations" autoFocus />
      </Field>
      <Field label="Description" htmlFor="lp-description">
        <textarea id="lp-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is this for and what will they be able to do?" />
      </Field>
      <ModulesEditor modules={modules} onChange={setModules} errors={errors} />
      <button type="button" className="btn ghost" onClick={() => setModules((m) => [...m, emptyModule()])}>
        <Icon name="plus" /> Add module
      </button>
      <FormError message={server.form} />
      <FormActions onCancel={onDone} submitting={create.isPending} submitLabel="Create learning path" submittingLabel="Creating…" />
    </form>
  );
}

export function AddModuleDialog({ open, onClose, learningPathId }: { open: boolean; onClose: () => void; learningPathId: string }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add module" description="Appended to the end of the path." wide>
      {open ? <AddModuleForm learningPathId={learningPathId} onDone={onClose} /> : null}
    </Dialog>
  );
}

function AddModuleForm({ learningPathId, onDone }: { learningPathId: string; onDone: () => void }) {
  const [modules, setModules] = useState<ModuleDraft[]>([emptyModule()]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const add = useAddLearningModule();
  const toast = useToast();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateModules(modules);
    setErrors(found);
    if (Object.keys(found).length) return;
    add.mutate({ id: learningPathId, body: toInput(modules)[0] }, { onSuccess: () => (toast.success("Module added"), onDone()) });
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <ModulesEditor modules={modules} onChange={setModules} errors={errors} />
      <FormError message={add.isError ? serverErrors(add.error).form : null} />
      <FormActions onCancel={onDone} submitting={add.isPending} submitLabel="Add module" submittingLabel="Adding…" />
    </form>
  );
}
