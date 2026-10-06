"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import {
  getMyUnreadNotificationCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  updateMyNotificationReadState,
  type NotificationPage,
} from "@/lib/api/notifications";

export const notificationKeys = {
  all: ["notifications"] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  feed: (status: "all" | "unread") => ["notifications", "feed", status] as const,
};

// Polling, not WebSockets: at PandaHat's scale a 30s poll of one indexed COUNT is
// cheap, and it works on free-tier hosts that don't keep long-lived connections.
const UNREAD_POLL_MS = 30_000;

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: getMyUnreadNotificationCount,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
    select: (data) => data.unread_count,
  });
}

export function useNotificationFeed(status: "all" | "unread", pageSize = 20) {
  return useInfiniteQuery({
    queryKey: notificationKeys.feed(status),
    queryFn: ({ pageParam }) => listMyNotifications({ cursor: pageParam, limit: pageSize, status }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}

type Feed = InfiniteData<NotificationPage, string | null>;

export function useSetReadState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) => updateMyNotificationReadState(id, isRead),
    // Optimistic update: flip the item immediately, roll back if the server says no.
    onMutate: async ({ id, isRead }) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const snapshot = queryClient.getQueriesData<Feed>({ queryKey: ["notifications", "feed"] });
      queryClient.setQueriesData<Feed>({ queryKey: ["notifications", "feed"] }, (feed) =>
        feed && {
          ...feed,
          pages: feed.pages.map((page) => ({
            ...page,
            items: page.items.map((n) =>
              n.notification_id === id
                ? { ...n, is_read: isRead, read_at: isRead ? new Date().toISOString() : null }
                : n,
            ),
          })),
        },
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (readBefore: string) => markAllMyNotificationsRead(readBefore),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
