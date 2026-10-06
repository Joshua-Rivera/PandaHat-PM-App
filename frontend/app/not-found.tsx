import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <p className="empty-title">Page not found</p>
      <p className="empty-description">The page you&apos;re looking for doesn&apos;t exist.</p>
      <div className="empty-action">
        <Link className="btn" href="/">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
