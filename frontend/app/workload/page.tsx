"use client";

import Link from "next/link";

import type { CapacityState } from "@/lib/api/types";
import { formatHours } from "@/lib/format";
import { useResearchers } from "@/lib/queries";

import { ManagerOnly } from "@/components/shell/ManagerOnly";
import { Avatar, CapacityBar, PageHeader, MemberTags, StatCard } from "@/components/ui/Primitives";
import { StatGridSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

const ORDER: Record<CapacityState, number> = { OVERLOADED: 0, AT_CAPACITY: 1, AVAILABLE: 2, NO_AVAILABILITY: 3 };

export default function WorkloadPage() {
  return (
    <ManagerOnly>
      <Workload />
    </ManagerOnly>
  );
}

function Workload() {
  const researchers = useResearchers();

  if (researchers.isPending) {
    return (
      <div className="page">
        <PageHeader title="Workload" description="Assigned hours against each researcher's weekly availability." />
        <StatGridSkeleton count={4} />
        <TableSkeleton rows={5} columns={3} />
      </div>
    );
  }
  if (researchers.isError) {
    return <ErrorState title="Couldn't load workload" error={researchers.error} onRetry={() => researchers.refetch()} />;
  }

  const team = [...researchers.data].sort(
    (a, b) =>
      ORDER[a.workload.capacity_state] - ORDER[b.workload.capacity_state] ||
      b.workload.assigned_hours - a.workload.assigned_hours,
  );
  const capacity = team.reduce((sum, r) => sum + r.workload.capacity_hours, 0);
  const assigned = team.reduce((sum, r) => sum + r.workload.assigned_hours, 0);
  const count = (state: CapacityState) => team.filter((r) => r.workload.capacity_state === state).length;

  return (
    <div className="page">
      <PageHeader title="Workload" description="Assigned hours (open tasks) against each researcher's weekly availability." />
      <div className="stat-grid four">
        <StatCard label="Available hours" value={formatHours(capacity)} hint="per week, whole team" />
        <StatCard label="Assigned hours" value={formatHours(assigned)} hint={capacity ? `${Math.round((assigned / capacity) * 100)}% utilised` : undefined} tone={assigned > capacity ? "danger" : undefined} />
        <StatCard label="Overloaded" value={count("OVERLOADED")} tone={count("OVERLOADED") ? "danger" : undefined} />
        <StatCard label="With spare capacity" value={count("AVAILABLE")} tone="success" />
      </div>
      {team.length === 0 ? (
        <EmptyState icon="users" title="No researchers yet" action={<Link className="btn" href="/team">Add researchers</Link>} />
      ) : (
        <div className="card table-card">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Tags</th>
                <th className="num">Open tasks</th>
                <th>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {team.map((r) => (
                <tr key={r.user_id}>
                  <td data-label="Researcher">
                    <Link href={`/team/${r.user_id}`} className="person-cell">
                      <Avatar name={r.display_name} size={24} />
                      <span>{r.display_name}</span>
                    </Link>
                  </td>
                  <td data-label="Tags">
                    <MemberTags status={r.research_status} commitment={r.commitment} />
                  </td>
                  <td data-label="Open tasks" className="num">{r.workload.open_task_count}</td>
                  <td data-label="Capacity" className="capacity-cell wide">
                    <CapacityBar workload={r.workload} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
