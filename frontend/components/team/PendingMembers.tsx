"use client";

import { useState } from "react";

import type { Commitment, PendingMember, ResearchStatus, Role } from "@/lib/api/types";
import { COMMITMENT_HOURS, COMMITMENT_LABEL, COMMITMENTS, RESEARCH_STATUS_LABEL, RESEARCH_STATUSES, ROLE_LABEL } from "@/lib/format";
import { useApproveMember, usePendingMembers, useRejectMember } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import { serverErrors } from "@/components/ui/Form";
import { Avatar, SectionHeader } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/Toast";

/** People who signed in with GitHub but aren't on the team yet. Hidden when there are none. */
export function PendingMembers() {
  const pending = usePendingMembers();
  if (!pending.data?.length) return null;
  return (
    <section className="card pending-card stack-md" aria-labelledby="pending-title">
      <SectionHeader title={`Waiting for approval · ${pending.data.length}`} />
      <p className="muted small" id="pending-title">
        These people signed in with GitHub. Approve them with a track and commitment, or decline.
      </p>
      <ul className="pending-list">
        {pending.data.map((m) => (
          <PendingRow key={m.user_id} member={m} />
        ))}
      </ul>
    </section>
  );
}

function PendingRow({ member }: { member: PendingMember }) {
  const { me } = useSession();
  const [role, setRole] = useState<Role>("researcher");
  const [track, setTrack] = useState<ResearchStatus>("LEARNING_PATH");
  const [commitment, setCommitment] = useState<Commitment>("SHADOW");
  const approve = useApproveMember();
  const reject = useRejectMember();
  const toast = useToast();
  const busy = approve.isPending || reject.isPending;
  const roles: Role[] = me.role === "admin" ? ["researcher", "pm", "admin"] : ["researcher", "pm"];
  const id = member.user_id.slice(0, 8);

  return (
    <li className="pending-item">
      <div className="pending-who">
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatar_url} alt="" width={36} height={36} />
        ) : (
          <Avatar name={member.display_name} size={36} />
        )}
        <span>
          <strong>{member.display_name}</strong>
          <span className="muted small block">
            {member.github_login ? `@${member.github_login} · ` : ""}
            {member.email}
          </span>
        </span>
      </div>
      <div className="pending-controls">
        <label className="inline-field">
          <span className="muted small">Role</span>
          <select id={`role-${id}`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span className="muted small">Track</span>
          <select value={track} onChange={(e) => setTrack(e.target.value as ResearchStatus)}>
            {RESEARCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RESEARCH_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span className="muted small">Commitment</span>
          <select value={commitment} onChange={(e) => setCommitment(e.target.value as Commitment)}>
            {COMMITMENTS.map((c) => (
              <option key={c} value={c}>
                {COMMITMENT_LABEL[c]} · {COMMITMENT_HOURS[c]}h
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={() =>
            approve.mutate(
              { id: member.user_id, body: { role, research_status: track, commitment } },
              {
                onSuccess: () => toast.success(`${member.display_name} approved`),
                onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't approve"),
              },
            )
          }
        >
          Approve
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            reject.mutate(member.user_id, {
              onSuccess: () => toast.success(`Declined ${member.display_name}`),
              onError: (e) => toast.error(serverErrors(e).form ?? "Couldn't decline"),
            })
          }
        >
          Decline
        </button>
      </div>
    </li>
  );
}
