"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Commitment, ResearchStatus } from "@/lib/api/types";
import {
  COMMITMENT_LABEL,
  COMMITMENTS,
  formatHours,
  RESEARCH_STATUS_LABEL,
  RESEARCH_STATUSES,
  WEEKDAYS,
} from "@/lib/format";
import { useTeamAvailability } from "@/lib/queries";

import { AvailabilityHeatmap } from "@/components/availability/AvailabilityHeatmap";
import { ManagerOnly } from "@/components/shell/ManagerOnly";
import { Icon } from "@/components/ui/Icon";
import { Avatar, Badge, MemberTags, PageHeader, SectionHeader, StatCard } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

export default function TeamAvailabilityPage() {
  return (
    <ManagerOnly>
      <TeamAvailability />
    </ManagerOnly>
  );
}

const ALL = "";

function TeamAvailability() {
  const team = useTeamAvailability();
  const [personId, setPersonId] = useState(ALL);
  const [track, setTrack] = useState<ResearchStatus | typeof ALL>(ALL);
  const [commitment, setCommitment] = useState<Commitment | typeof ALL>(ALL);
  const [day, setDay] = useState<string>(ALL);

  const rows = useMemo(() => {
    const members = team.data ?? [];
    return members.filter(
      (m) =>
        (!personId || m.user_id === personId) &&
        (!track || m.research_status === track) &&
        (!commitment || m.commitment === commitment) &&
        (day === ALL || m.blocks.some((b) => b.weekday === Number(day))),
    );
  }, [team.data, personId, track, commitment, day]);

  const days = day === ALL ? WEEKDAYS.map((_, i) => i) : [Number(day)];
  const selected = personId ? team.data?.find((m) => m.user_id === personId) : undefined;
  const filtered = !!(personId || track || commitment || day !== ALL);
  const shortfall = rows.filter((m) => m.weekly_capacity_hours < m.committed_hours);

  return (
    <div className="page">
      <PageHeader
        title="Team availability"
        description="When everyone can work each week, next to the hours their commitment promises (Shadow 5h, Full-time 10h)."
      />

      <div className="filter-bar" role="group" aria-label="Filter availability">
        <label className="inline-field">
          <span className="muted small">Person</span>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value={ALL}>Everyone</option>
            {(team.data ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span className="muted small">Track</span>
          <select value={track} onChange={(e) => setTrack(e.target.value as ResearchStatus | typeof ALL)}>
            <option value={ALL}>All tracks</option>
            {RESEARCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RESEARCH_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span className="muted small">Commitment</span>
          <select value={commitment} onChange={(e) => setCommitment(e.target.value as Commitment | typeof ALL)}>
            <option value={ALL}>Any commitment</option>
            {COMMITMENTS.map((c) => (
              <option key={c} value={c}>
                {COMMITMENT_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span className="muted small">Available on</span>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            <option value={ALL}>Any day</option>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {filtered ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => (setPersonId(ALL), setTrack(ALL), setCommitment(ALL), setDay(ALL))}
          >
            <Icon name="close" size={14} /> Clear filters
          </button>
        ) : null}
      </div>

      {team.isPending ? (
        <TableSkeleton rows={5} columns={5} />
      ) : team.isError ? (
        <ErrorState title="Couldn't load team availability" error={team.error} onRetry={() => team.refetch()} />
      ) : team.data.length === 0 ? (
        <EmptyState icon="users" title="No team members yet" description="Add people from the Team page." compact />
      ) : (
        <>
          {selected ? (
            <section className="card stack-md person-focus">
              <div className="row gap-sm wrap person-focus-head">
                <Avatar name={selected.display_name} size={40} />
                <div className="grow">
                  <Link href={`/team/${selected.user_id}`}>
                    <strong>{selected.display_name}</strong>
                  </Link>
                  <MemberTags status={selected.research_status} commitment={selected.commitment} />
                </div>
              </div>
              <div className="stat-grid three">
                <StatCard
                  label="Available"
                  value={formatHours(selected.weekly_capacity_hours)}
                  hint={`of ${formatHours(selected.committed_hours)} committed`}
                  tone={selected.weekly_capacity_hours < selected.committed_hours ? "warning" : "success"}
                />
                <StatCard label="Assigned" value={formatHours(selected.assigned_hours)} hint="open tasks" />
                <StatCard label="Days available" value={new Set(selected.blocks.map((b) => b.weekday)).size} hint="per week" />
              </div>
            </section>
          ) : (
            <div className="stat-grid four">
              <StatCard label="Showing" value={rows.length} hint={filtered ? "matching filters" : "team members"} />
              <StatCard
                label="Available hours"
                value={formatHours(rows.reduce((s, m) => s + m.weekly_capacity_hours, 0))}
                hint={`of ${formatHours(rows.reduce((s, m) => s + m.committed_hours, 0))} committed`}
              />
              <StatCard label="Below commitment" value={shortfall.length} tone={shortfall.length ? "warning" : "success"} />
              <StatCard label="No availability set" value={rows.filter((m) => m.blocks.length === 0).length} />
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState icon="search" title="Nobody matches" description="Try clearing a filter." compact />
          ) : (
            <>
              <AvailabilityHeatmap members={rows} days={days} focusId={personId || undefined} />
              <div className="card member-hours">
                <SectionHeader title="Weekly hours" />
                <ul className="member-hours-list">
                  {rows.map((m) => {
                    const short = m.weekly_capacity_hours < m.committed_hours;
                    const pct = m.committed_hours ? Math.min(100, (m.weekly_capacity_hours / m.committed_hours) * 100) : 0;
                    return (
                      <li key={m.user_id} className={m.user_id === personId ? "selected" : undefined}>
                        <button type="button" className="person-cell link-button" onClick={() => setPersonId(m.user_id === personId ? ALL : m.user_id)}>
                          <Avatar name={m.display_name} />
                          <span>
                            <strong>{m.display_name}</strong>
                            <MemberTags status={m.research_status} commitment={m.commitment} />
                          </span>
                        </button>
                        <span className="hours-meter" aria-hidden="true">
                          <i style={{ width: `${pct}%` }} className={short ? "short" : undefined} />
                        </span>
                        <span className="weekly-hours">
                          <strong>{formatHours(m.weekly_capacity_hours)}</strong>
                          <span className="muted small"> / {formatHours(m.committed_hours)}</span>
                          {short ? <Badge tone="warning">Below</Badge> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
