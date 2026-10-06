"use client";

import { formatHours } from "@/lib/format";
import { useMyAvailability } from "@/lib/queries";

import { AvailabilityEditor } from "@/components/availability/AvailabilityEditor";
import { PageHeader } from "@/components/ui/Primitives";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";

export default function AvailabilityPage() {
  const availability = useMyAvailability();
  return (
    <div className="page">
      <PageHeader
        title="Availability"
        description={
          availability.data
            ? `When you can work on research each week. You currently have ${formatHours(availability.data.assigned_hours)} of open tasks assigned.`
            : "When you can work on research each week."
        }
      />
      {availability.isPending ? (
        <div className="availability-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="card availability-day">
              <Skeleton width="40%" height={14} />
              <Skeleton height={32} />
            </div>
          ))}
        </div>
      ) : availability.isError ? (
        <ErrorState title="Couldn't load your availability" error={availability.error} onRetry={() => availability.refetch()} />
      ) : (
        <AvailabilityEditor initial={availability.data} />
      )}
    </div>
  );
}
