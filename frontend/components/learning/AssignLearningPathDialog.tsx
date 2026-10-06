"use client";

import { useState, type FormEvent } from "react";

import { useAssignLearningPath, useLearningPaths, useResearchers } from "@/lib/queries";

import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export function AssignLearningPathDialog({
  open,
  onClose,
  researcherId,
  learningPathId,
}: {
  open: boolean;
  onClose: () => void;
  researcherId?: string;
  learningPathId?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Assign learning path" description="The researcher is notified and starts with the first task.">
      {open ? <AssignForm researcherId={researcherId} learningPathId={learningPathId} onDone={onClose} /> : null}
    </Dialog>
  );
}

function AssignForm({ researcherId, learningPathId, onDone }: { researcherId?: string; learningPathId?: string; onDone: () => void }) {
  const [userId, setUserId] = useState(researcherId ?? "");
  const [pathId, setPathId] = useState(learningPathId ?? "");
  const [target, setTarget] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const researchers = useResearchers();
  const paths = useLearningPaths();
  const assign = useAssignLearningPath();
  const toast = useToast();
  const server = assign.isError ? serverErrors(assign.error) : { fields: {} as FieldErrors, form: null };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!userId) found.user = "Choose a researcher.";
    if (!pathId) found.learning_path_id = "Choose a learning path.";
    setErrors(found);
    if (Object.keys(found).length) return;
    assign.mutate(
      { userId, body: { learning_path_id: pathId, target_date: target || null } },
      {
        onSuccess: (progress) => {
          const who = researchers.data?.find((r) => r.user_id === userId)?.display_name ?? "Researcher";
          toast.success(`${who} assigned to ${progress.name}`);
          onDone();
        },
      },
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {!researcherId ? (
        <Field label="Researcher" htmlFor="assign-researcher" required error={errors.user}>
          <select id="assign-researcher" value={userId} onChange={(e) => setUserId(e.target.value)} disabled={researchers.isPending}>
            <option value="">{researchers.isPending ? "Loading…" : "Choose a researcher…"}</option>
            {(researchers.data ?? []).map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {r.display_name}
                {r.learning ? ` (currently: ${r.learning.name})` : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {!learningPathId ? (
        <Field label="Learning path" htmlFor="assign-path" required error={errors.learning_path_id ?? server.fields.learning_path_id}>
          <select id="assign-path" value={pathId} onChange={(e) => setPathId(e.target.value)} disabled={paths.isPending}>
            <option value="">{paths.isPending ? "Loading…" : paths.data?.length ? "Choose a path…" : "No learning paths yet"}</option>
            {(paths.data ?? []).map((p) => (
              <option key={p.learning_path_id} value={p.learning_path_id}>
                {p.name} ({p.task_count} tasks)
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Target date" htmlFor="assign-target" hint="Optional: when they should finish.">
        <input id="assign-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
      </Field>
      <FormError message={server.form} />
      <FormActions onCancel={onDone} submitting={assign.isPending} submitLabel="Assign path" submittingLabel="Assigning…" />
    </form>
  );
}
