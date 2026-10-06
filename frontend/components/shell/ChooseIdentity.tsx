"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { bootstrapDevAdmin, listDevIdentities } from "@/lib/api/endpoints";
import { RESEARCH_STATUS_LABEL, ROLE_LABEL } from "@/lib/format";

import { Field, FormError, serverErrors } from "@/components/ui/Form";
import { Avatar } from "@/components/ui/Primitives";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";

/** DEVELOPMENT ONLY: stands in for a login screen while AUTH_MODE=dev. */
export function ChooseIdentity({ onChoose, notice }: { onChoose: (userId: string) => void; notice?: string }) {
  const identities = useQuery({ queryKey: ["dev", "identities"], queryFn: listDevIdentities });

  return (
    <div className="center-screen">
      <div className="card identity-card">
        <div className="stack-sm">
          <span className="dev-tag">Development mode</span>
          <h1>Who are you working as?</h1>
          <p className="muted">
            PandaHat doesn&apos;t have sign-in yet. Pick a team member to view the app as them. You can switch any time
            from &ldquo;Viewing as&rdquo; in the header.
          </p>
          {notice ? <p className="form-error">{notice}</p> : null}
        </div>
        {identities.isPending ? (
          <div className="stack-sm">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        ) : identities.isError ? (
          <ErrorState error={identities.error} onRetry={() => identities.refetch()} compact />
        ) : identities.data.length === 0 ? (
          <BootstrapForm onCreated={onChoose} />
        ) : (
          <ul className="identity-list">
            {identities.data.map((user) => (
              <li key={user.user_id}>
                <button type="button" className="identity-option" onClick={() => onChoose(user.user_id)}>
                  <Avatar name={user.display_name} />
                  <span className="grow">
                    <strong>{user.display_name}</strong>
                    <span className="muted small">
                      {ROLE_LABEL[user.role]}
                      {user.role === "researcher" ? ` · ${RESEARCH_STATUS_LABEL[user.research_status]}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BootstrapForm({ onCreated }: { onCreated: (userId: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const create = useMutation({ mutationFn: bootstrapDevAdmin, onSuccess: (user) => onCreated(user.user_id) });
  const errors = create.isError ? serverErrors(create.error) : { fields: {}, form: null };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ display_name: name, email });
  };

  return (
    <form className="stack-md" onSubmit={submit}>
      <p className="muted">The database is empty. Create the first project manager, then build the team from the Team page.</p>
      <Field label="Your name" htmlFor="bootstrap-name" required error={errors.fields.display_name}>
        <input id="bootstrap-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Shah" required />
      </Field>
      <Field label="Email" htmlFor="bootstrap-email" required error={errors.fields.email}>
        <input id="bootstrap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" required />
      </Field>
      <FormError message={errors.form} />
      <button type="submit" className="btn primary" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create project manager"}
      </button>
    </form>
  );
}
