// Skeletons mirror the final layout so the page doesn't jump when data arrives.

export function Skeleton({ width = "100%", height = 12, className = "" }: { width?: string | number; height?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function PageHeaderSkeleton() {
  return (
    <div className="page-header" aria-hidden="true">
      <div className="stack-sm">
        <Skeleton width={220} height={22} />
        <Skeleton width={320} height={12} />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card stat-card" aria-hidden="true">
      <Skeleton width="55%" height={11} />
      <Skeleton width="35%" height={24} />
    </div>
  );
}

export function StatGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="task-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="task-row">
          <Skeleton width={16} height={16} className="round" />
          <div className="stack-sm grow">
            <Skeleton width={`${60 - i * 7}%`} height={13} />
            <Skeleton width="30%" height={10} />
          </div>
          <Skeleton width={64} height={20} />
        </li>
      ))}
    </ul>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="card project-card" aria-hidden="true">
      <Skeleton width="65%" height={15} />
      <Skeleton width="40%" height={11} />
      <Skeleton width="100%" height={6} />
      <div className="row gap-md">
        <Skeleton width={70} height={11} />
        <Skeleton width={70} height={11} />
      </div>
    </div>
  );
}

export function ProjectGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="project-grid">
      {Array.from({ length: count }, (_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="card table-card" aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="table-skeleton-row">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} width={c === 0 ? "70%" : "50%"} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function NotificationSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="notification-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="notification-item">
          <Skeleton width="30%" height={10} />
          <Skeleton width="80%" height={13} />
          <Skeleton width="50%" height={11} />
        </li>
      ))}
    </ul>
  );
}
