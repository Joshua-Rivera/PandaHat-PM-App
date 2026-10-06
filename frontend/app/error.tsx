"use client";

import { ErrorState } from "@/components/ui/States";

/** Route-level error boundary: a rendering bug shows a recoverable message, not a blank page. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="Something went wrong on this page" error={error} onRetry={reset} />;
}
