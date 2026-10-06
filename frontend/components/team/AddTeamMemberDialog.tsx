"use client";

import { useState, type FormEvent } from "react";

import type { Commitment, ResearchStatus, Role } from "@/lib/api/types";
import { COMMITMENT_HOURS, COMMITMENT_LABEL, COMMITMENTS, RESEARCH_STATUS_LABEL, RESEARCH_STATUSES, ROLE_LABEL } from "@/lib/format";
import { useCreateUser } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormActions, FormError, parseList, serverErrors, type FieldErrors } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export function AddTeamMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add team member" description="When they sign in with GitHub using this email, their account links automatically.">
      {open ? <AddTeamMemberForm onDone={onClose} /> : null}
    </Dialog>
  );
}

function AddTeamMemberForm({ onDone }: { onDone: () => void }) {
  const { me } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("researcher");
  const [status, setStatus] = useState<ResearchStatus>("LEARNING_PATH");
  const [commitment, setCommitment] = useState<Commitment>("SHADOW");
  const [skills, setSkills] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateUser();
  const toast = useToast();
  const server = create.isError ? serverErrors(create.error) : { fields: {} as FieldErrors, form: null };
  const allErrors = { ...server.fields, ...errors };
  const roles: Role[] = me.role === "admin" ? ["researcher", "pm", "admin"] : ["researcher", "pm"];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!name.trim()) found.display_name = "Enter their name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Enter a valid email address.";
    setErrors(found);
    if (Object.keys(found).length) return;
    create.mutate(
      { display_name: name.trim(), email: email.trim(), role, research_status: status, commitment, skills: parseList(skills) },
      { onSuccess: (user) => (toast.success(`${user.display_name} added to the team`), onDone()) },
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Name" htmlFor="member-name" required error={allErrors.display_name}>
        <input id="member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Lovelace" autoFocus />
      </Field>
      <Field label="Email" htmlFor="member-email" required error={allErrors.email}>
        <input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@university.edu" />
      </Field>
      <div className="form-grid">
        <Field label="Role" htmlFor="member-role" error={allErrors.role}>
          <select id="member-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Track" htmlFor="member-status">
          <select id="member-status" value={status} onChange={(e) => setStatus(e.target.value as ResearchStatus)}>
            {RESEARCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RESEARCH_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Commitment" htmlFor="member-commitment">
          <select id="member-commitment" value={commitment} onChange={(e) => setCommitment(e.target.value as Commitment)}>
            {COMMITMENTS.map((c) => (
              <option key={c} value={c}>
                {COMMITMENT_LABEL[c]} · {COMMITMENT_HOURS[c]}h/week
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Skills" htmlFor="member-skills" hint="Comma-separated, e.g. Python, PyTorch">
        <input id="member-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, PyTorch" />
      </Field>
      <FormError message={server.form} />
      <FormActions onCancel={onDone} submitting={create.isPending} submitLabel="Add member" submittingLabel="Adding…" />
    </form>
  );
}
