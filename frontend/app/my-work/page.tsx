"use client";

import { useState } from "react";

import type { TaskStatus } from "@/lib/api/types";
import { useTasks } from "@/lib/queries";

import { useSession } from "@/components/shell/Session";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { PageHeader, Tabs } from "@/components/ui/Primitives";
import { TaskListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import type { Task } from "@/lib/api/types";

type Filter = "ALL" | TaskStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETED", label: "Completed" },
];

const EMPTY: Record<Filter, { title: string; description: string }> = {
  ALL: { title: "No tasks assigned", description: "You're all caught up. New assignments show up here and in your notifications." },
  TODO: { title: "Nothing waiting to start", description: "Tasks you haven't started yet will show here." },
  IN_PROGRESS: { title: "Nothing in progress", description: "Move a task to In progress when you start working on it." },
  BLOCKED: { title: "Nothing blocked", description: "Great: none of your tasks are blocked." },
  COMPLETED: { title: "No completed tasks yet", description: "Finished work collects here." },
};

export default function MyWorkPage() {
  const { me } = useSession();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<Task | null>(null);
  const tasks = useTasks({ assignee: "me" });

  const all = tasks.data ?? [];
  const visible = filter === "ALL" ? all : all.filter((t) => t.status === filter);
  const count = (f: Filter) => (f === "ALL" ? all.length : all.filter((t) => t.status === f).length);

  return (
    <div className="page">
      <PageHeader title="My Work" description="Everything assigned to you, across projects." />
      <Tabs label="Filter tasks by status" tabs={FILTERS.map((f) => ({ ...f, count: tasks.data ? count(f.value) : undefined }))} value={filter} onChange={setFilter} />
      <div className="card">
        {tasks.isPending ? (
          <TaskListSkeleton rows={5} />
        ) : tasks.isError ? (
          <ErrorState title="Couldn't load your tasks" error={tasks.error} onRetry={() => tasks.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState icon={filter === "ALL" ? "check" : "circle"} title={EMPTY[filter].title} description={EMPTY[filter].description} />
        ) : (
          <TaskList tasks={visible} showAssignee={false} showDescription onEdit={me.is_manager ? setEditing : undefined} />
        )}
      </div>
      <TaskFormDialog open={!!editing} onClose={() => setEditing(null)} task={editing} />
    </div>
  );
}
