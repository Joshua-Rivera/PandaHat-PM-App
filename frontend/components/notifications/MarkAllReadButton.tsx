"use client";

import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api/client";
import { useMarkAllRead } from "@/lib/notifications/hooks";

export function MarkAllReadButton({ compact = false }: { compact?: boolean }) {
  const markAllRead = useMarkAllRead();
  const toast = useToast();
  // "Now" as the cutoff: anything arriving after the click stays unread.
  return (
    <button
      type="button"
      className={compact ? "link-btn" : "btn"}
      disabled={markAllRead.isPending}
      onClick={() =>
        markAllRead.mutate(new Date().toISOString(), {
          onError: (error) => toast.error(`Couldn't mark notifications as read. ${errorMessage(error)}`),
        })
      }
    >
      {markAllRead.isPending ? "Marking…" : "Mark all as read"}
    </button>
  );
}
