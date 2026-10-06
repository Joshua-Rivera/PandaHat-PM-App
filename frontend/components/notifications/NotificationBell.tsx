"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useUnreadCount } from "@/lib/notifications/hooks";

import { MarkAllReadButton } from "./MarkAllReadButton";
import { NotificationList } from "./NotificationList";

export function NotificationBell() {
  const { data: unreadCount = 0 } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={containerRef}>
      <button
        type="button"
        className="icon-btn bell-button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 ? <span className="bell-count">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="popover bell-panel" role="dialog" aria-label="Recent notifications">
          <header className="bell-panel-header">
            <strong>Notifications</strong>
            {unreadCount > 0 ? <MarkAllReadButton compact /> : null}
          </header>
          <div className="bell-panel-body">
            <NotificationList status="all" pageSize={8} paginate={false} compact onNavigate={() => setOpen(false)} />
          </div>
          <footer className="bell-panel-footer">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
