"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/States";

import { useSession } from "./Session";

/** UX only: hides PM pages from researchers. The API enforces the same rule on every request. */
export function ManagerOnly({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (me.is_manager) return <>{children}</>;
  return (
    <EmptyState
      icon="users"
      title="This page is for project managers"
      description="Ask a project manager if you need something changed here."
      action={
        <Link className="btn" href="/">
          Back to dashboard
        </Link>
      }
    />
  );
}
