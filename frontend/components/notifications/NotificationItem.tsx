"use client";

import { useRouter } from "next/navigation";

import type { Notification } from "@/lib/api/notifications";
import { eventLabel, PRIORITY_COLOR, relativeTime } from "@/lib/notifications/format";
import { useSetReadState } from "@/lib/notifications/hooks";

export function NotificationItem({ notification, onNavigate }: { notification: Notification; onNavigate?: () => void }) {
  const setReadState = useSetReadState();
  const router = useRouter();
  const { notification_id: id, is_read: isRead } = notification;
  const urgent = notification.priority === "HIGH" || notification.priority === "URGENT";

  const open = () => {
    if (!isRead) setReadState.mutate({ id, isRead: true });
    if (notification.action_path) {
      onNavigate?.();
      router.push(notification.action_path);
    }
  };

  return (
    <li className={`notification-item${isRead ? "" : " unread"}`} style={urgent ? { borderLeftColor: PRIORITY_COLOR[notification.priority] } : undefined}>
      <button type="button" className="notification-main" onClick={open}>
        <span className="notification-meta">
          {!isRead ? <span className="unread-dot" aria-label="Unread" /> : null}
          <span className="notification-label">{eventLabel(notification.event_type)}</span>
          {urgent ? (
            <span className="notification-priority" style={{ color: PRIORITY_COLOR[notification.priority] }}>
              {notification.priority}
            </span>
          ) : null}
          <time dateTime={notification.created_at} title={new Date(notification.created_at).toLocaleString()}>
            {relativeTime(notification.created_at)}
          </time>
        </span>
        <span className="notification-title">{notification.title}</span>
        {notification.body ? <span className="notification-body">{notification.body}</span> : null}
      </button>
      <button
        type="button"
        className="link-btn notification-toggle"
        onClick={() => setReadState.mutate({ id, isRead: !isRead })}
      >
        Mark as {isRead ? "unread" : "read"}
      </button>
    </li>
  );
}
