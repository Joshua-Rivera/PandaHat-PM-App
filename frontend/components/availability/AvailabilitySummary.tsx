import type { AvailabilityBlock } from "@/lib/api/types";
import { WEEKDAYS } from "@/lib/format";

export const hhmm = (t: string) => t.slice(0, 5);

export function formatTime(t: string): string {
  const [h, m] = hhmm(t).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** Read-only week view of availability blocks. */
export function AvailabilitySummary({ blocks }: { blocks: AvailabilityBlock[] }) {
  return (
    <ul className="week-summary">
      {WEEKDAYS.map((day, weekday) => {
        const dayBlocks = blocks.filter((b) => b.weekday === weekday);
        return (
          <li key={day}>
            <span className="week-day">{day.slice(0, 3)}</span>
            {dayBlocks.length ? (
              <span>{dayBlocks.map((b) => `${formatTime(b.start_time)}–${formatTime(b.end_time)}`).join(", ")}</span>
            ) : (
              <span className="muted">Unavailable</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
