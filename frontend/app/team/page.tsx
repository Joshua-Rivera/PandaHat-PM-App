"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useResearchers } from "@/lib/queries";

import { ManagerOnly } from "@/components/shell/ManagerOnly";
import { AddTeamMemberDialog } from "@/components/team/AddTeamMemberDialog";
import { PendingMembers } from "@/components/team/PendingMembers";
import { Icon } from "@/components/ui/Icon";
import { Avatar, CapacityBar, MemberTags, PageHeader } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

export default function TeamPage() {
  return (
    <ManagerOnly>
      <Team />
    </ManagerOnly>
  );
}

function Team() {
  const researchers = useResearchers();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return researchers.data ?? [];
    return (researchers.data ?? []).filter((r) =>
      [r.display_name, r.email, ...r.skills, ...r.projects.map((p) => p.name)].some((v) => v.toLowerCase().includes(q)),
    );
  }, [researchers.data, query]);

  return (
    <div className="page">
      <PageHeader
        title="Team"
        description="Researchers, their track and commitment tags, projects and capacity."
        actions={
          <>
            <Link href="/learning" className="btn">
              <Icon name="book" size={14} /> Learning paths
            </Link>
            <Link href="/team-availability" className="btn">
              <Icon name="calendar" /> Availability
            </Link>
            <button type="button" className="btn primary" onClick={() => setAdding(true)}>
              <Icon name="plus" /> Add member
            </button>
          </>
        }
      />
      <PendingMembers />
      <label className="search">
        <Icon name="search" />
        <input type="search" placeholder="Search researchers, skills or projects…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search researchers" />
      </label>
      {researchers.isPending ? (
        <TableSkeleton rows={5} columns={4} />
      ) : researchers.isError ? (
        <ErrorState title="Couldn't load the team" error={researchers.error} onRetry={() => researchers.refetch()} />
      ) : researchers.data.length === 0 ? (
        <EmptyState
          icon="users"
          title="No researchers yet"
          description="Add the people in your research group so you can assign them projects, tasks and learning paths."
          action={<button type="button" className="btn primary" onClick={() => setAdding(true)}>Add member</button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search" title="No matches" description={`Nobody matches "${query}".`} compact />
      ) : (
        <div className="card table-card">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Tags</th>
                <th>Projects</th>
                <th>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id}>
                  <td data-label="Researcher">
                    <Link href={`/team/${r.user_id}`} className="person-cell">
                      <Avatar name={r.display_name} />
                      <span>
                        <strong>{r.display_name}</strong>
                        <span className="muted small block">{r.skills.join(", ") || r.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td data-label="Tags">
                    <MemberTags status={r.research_status} commitment={r.commitment} />
                    {r.learning ? <span className="muted small block">{r.learning.name} · {r.learning.progress_percent}%</span> : null}
                  </td>
                  <td data-label="Projects">{r.projects.length ? r.projects.map((p) => p.name).join(", ") : <span className="muted">—</span>}</td>
                  <td data-label="Capacity" className="capacity-cell">
                    <CapacityBar workload={r.workload} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddTeamMemberDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
