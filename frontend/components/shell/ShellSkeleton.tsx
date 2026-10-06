import { PageHeaderSkeleton, Skeleton, StatGridSkeleton, TaskListSkeleton } from "@/components/ui/Skeleton";

export function ShellSkeleton() {
  return (
    <div className="app">
      <aside className="sidebar" aria-hidden="true">
        <div className="brand"><span className="brand-name">PandaHat</span></div>
        <div className="stack-md nav-skeleton">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width="70%" height={12} />
          ))}
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar" />
        <main className="content">
          <PageHeaderSkeleton />
          <StatGridSkeleton />
          <div className="card">
            <TaskListSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}
