"use client";

import { useState, type FormEvent } from "react";

import { COMMITMENT_LABEL, RESEARCH_STATUS_LABEL, ROLE_LABEL } from "@/lib/format";
import { useUpdateMe } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import { Field, FormError, parseList, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { PageHeader, SectionHeader } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { me } = useSession();
  const [name, setName] = useState(me.display_name);
  const [skills, setSkills] = useState(me.skills.join(", "));
  const [errors, setErrors] = useState<FieldErrors>({});
  const update = useUpdateMe();
  const toast = useToast();
  const server = update.isError ? serverErrors(update.error) : { fields: {} as FieldErrors, form: null };
  const dirty = name.trim() !== me.display_name || skills !== me.skills.join(", ");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setErrors({ display_name: "Your name can't be empty." });
    setErrors({});
    update.mutate({ display_name: name.trim(), skills: parseList(skills) }, { onSuccess: () => toast.success("Profile saved") });
  };

  return (
    <div className="page narrow">
      <PageHeader title="Settings" />
      <section className="card">
        <SectionHeader title="Profile" />
        <form className="form" onSubmit={submit} noValidate>
          <Field label="Display name" htmlFor="settings-name" required error={errors.display_name ?? server.fields.display_name}>
            <input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Skills" htmlFor="settings-skills" hint="Comma-separated. PMs use these when assigning work." error={server.fields.skills}>
            <input id="settings-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, PyTorch, Watermarking" />
          </Field>
          <dl className="definition compact">
            <dt>Email</dt>
            <dd>{me.email}</dd>
            <dt>Role</dt>
            <dd>{ROLE_LABEL[me.role]}</dd>
            {me.role === "researcher" ? (
              <>
                <dt>Track</dt>
                <dd>{RESEARCH_STATUS_LABEL[me.research_status]}</dd>
                <dt>Commitment</dt>
                <dd>
                  {COMMITMENT_LABEL[me.commitment]} · {me.committed_hours}h per week
                </dd>
              </>
            ) : null}
          </dl>
          <FormError message={server.form} />
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={!dirty || update.isPending}>
              {update.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>
      <section className="card">
        <SectionHeader title="Notification preferences" />
        <p className="muted">
          Per-event email and in-app preferences arrive with email notifications (Notification Phase 4). Until then, every
          notification is delivered in-app.
        </p>
      </section>
    </div>
  );
}
