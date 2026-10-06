"use client";

import { useState } from "react";

import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";
import { NotificationList } from "@/components/notifications/NotificationList";
import { PageHeader, Tabs } from "@/components/ui/Primitives";

export default function NotificationsPage() {
  const [status, setStatus] = useState<"all" | "unread">("all");
  return (
    <div className="page narrow">
      <PageHeader title="Notifications" description="Assignments, deadlines, learning and announcements." actions={<MarkAllReadButton />} />
      <Tabs
        label="Filter notifications"
        value={status}
        onChange={setStatus}
        tabs={[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread" },
        ]}
      />
      <div className="card flush">
        <NotificationList status={status} pageSize={20} paginate />
      </div>
    </div>
  );
}
