"use client";

import { NotificationSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useNotificationFeed } from "@/lib/notifications/hooks";

import { NotificationItem } from "./NotificationItem";

export function NotificationList({
  status,
  pageSize,
  paginate,
  compact = false,
  onNavigate,
}: {
  status: "all" | "unread";
  pageSize: number;
  paginate: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const feed = useNotificationFeed(status, pageSize);

  if (feed.isPending) return <NotificationSkeleton rows={compact ? 3 : 5} />;
  if (feed.isError) {
    return <ErrorState title="Couldn't load notifications" error={feed.error} onRetry={() => feed.refetch()} compact={compact} />;
  }

  const items = feed.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return status === "unread" ? (
      <EmptyState icon="check" title="You're all caught up" description="No unread notifications." compact={compact} />
    ) : (
      <EmptyState
        icon="bell"
        title="No notifications yet"
        description="You'll be notified here when you're assigned tasks, projects or learning work."
        compact={compact}
      />
    );
  }

  return (
    <>
      <ul className="notification-list">
        {items.map((n) => (
          <NotificationItem key={n.notification_id} notification={n} onNavigate={onNavigate} />
        ))}
      </ul>
      {paginate && feed.hasNextPage ? (
        <button type="button" className="btn load-more" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
          {feed.isFetchingNextPage ? "Loading older…" : "Load older"}
        </button>
      ) : null}
    </>
  );
}
