// Function names match the FastAPI operation_ids (design report §6).
import { apiFetch } from "./client";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface Notification {
  notification_id: number;
  event_type: string;
  priority: Priority;
  title: string;
  body: string;
  resource_type: string | null;
  resource_id: string | null;
  action_path: string | null;
  actor_user_id: string | null;
  created_at: string;
  read_at: string | null;
  is_read: boolean;
}

export interface NotificationPage {
  items: Notification[];
  next_cursor: string | null;
}

const BASE = "/api/v1/me/notifications";

export function listMyNotifications(params: { cursor?: string | null; limit?: number; status?: "all" | "unread" }) {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  return apiFetch<NotificationPage>(`${BASE}?${query}`);
}

export function getMyUnreadNotificationCount() {
  return apiFetch<{ unread_count: number }>(`${BASE}/unread-count`);
}

export function updateMyNotificationReadState(notificationId: number, isRead: boolean) {
  return apiFetch<Notification>(`${BASE}/${notificationId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_read: isRead }),
  });
}

export function markAllMyNotificationsRead(readBefore: string) {
  return apiFetch<{ updated_count: number }>(`${BASE}/mark-all-read`, {
    method: "POST",
    body: JSON.stringify({ read_before: readBefore }),
  });
}
