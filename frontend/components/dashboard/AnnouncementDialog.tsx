"use client";

import { useState, type FormEvent } from "react";

import { useCreateAnnouncement, useProjects } from "@/lib/queries";

import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export function AnnouncementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="New announcement" description="Sent as an in-app notification.">
      {open ? <AnnouncementForm onDone={onClose} /> : null}
    </Dialog>
  );
}

function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [projectId, setProjectId] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const projects = useProjects();
  const create = useCreateAnnouncement();
  const toast = useToast();
  const server = create.isError ? serverErrors(create.error) : { fields: {} as FieldErrors, form: null };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!title.trim()) found.title = "Add a short headline.";
    if (!message.trim()) found.message = "Write the announcement.";
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate(
      { title: title.trim(), message: message.trim(), audience: projectId ? "PROJECT" : "ALL", project_id: projectId || null, is_urgent: urgent },
      {
        onSuccess: ({ recipient_count }) => {
          toast.success(`Announcement sent to ${recipient_count} ${recipient_count === 1 ? "person" : "people"}`);
          onDone();
        },
      },
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Headline" htmlFor="ann-title" required error={errors.title ?? server.fields.title}>
        <input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly meeting moved to Thursday" autoFocus />
      </Field>
      <Field label="Message" htmlFor="ann-message" required error={errors.message ?? server.fields.message}>
        <textarea id="ann-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Details people need to know." />
      </Field>
      <Field label="Audience" htmlFor="ann-audience">
        <select id="ann-audience" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Everyone in PandaHat</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.project_id} value={p.project_id}>
              Members of {p.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="checkbox">
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Mark as urgent
      </label>
      <FormError message={server.form} />
      <FormActions onCancel={onDone} submitting={create.isPending} submitLabel="Send announcement" submittingLabel="Sending…" />
    </form>
  );
}
