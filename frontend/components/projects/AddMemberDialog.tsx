"use client";

import { useState, type FormEvent } from "react";

import type { ProjectDetail } from "@/lib/api/types";
import { useAddProjectMember, useResearchers } from "@/lib/queries";

import { ResearcherSelector } from "@/components/tasks/Selectors";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, serverErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export function AddMemberDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project: ProjectDetail }) {
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const researchers = useResearchers(open);
  const add = useAddProjectMember();
  const toast = useToast();
  const memberIds = new Set(project.members.map((m) => m.user_id));
  const candidates = (researchers.data ?? []).filter((r) => !memberIds.has(r.user_id));

  const close = () => {
    setUserId("");
    setError("");
    add.reset();
    onClose();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return setError("Choose a researcher.");
    add.mutate(
      { projectId: project.project_id, userId },
      {
        onSuccess: () => {
          toast.success(`${candidates.find((c) => c.user_id === userId)?.display_name ?? "Researcher"} added to ${project.name}`);
          close();
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={close} title="Add researcher" description={`They'll be notified that they joined ${project.name}.`}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Researcher" htmlFor="member-select" required error={error}>
          <ResearcherSelector
            id="member-select"
            value={userId}
            onChange={(v) => (setUserId(v), setError(""))}
            researchers={candidates}
            placeholder={researchers.isPending ? "Loading researchers…" : candidates.length ? "Choose a researcher…" : "Everyone is already on this project"}
          />
        </Field>
        <FormError message={add.isError ? serverErrors(add.error).form : null} />
        <FormActions onCancel={close} submitting={add.isPending} submitLabel="Add to project" submittingLabel="Adding…" />
      </form>
    </Dialog>
  );
}
