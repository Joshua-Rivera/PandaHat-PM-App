"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/client";

import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "circle",
  title,
  description,
  action,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <span className="empty-icon">
        <Icon name={icon} size={compact ? 18 : 22} />
      </span>
      <p className="empty-title">{title}</p>
      {description ? <p className="empty-description">{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

export function ErrorState({
  title = "Couldn't load this data",
  error,
  onRetry,
  compact = false,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const status = error instanceof ApiError ? error.status : null;
  const description =
    status === 0
      ? "PandaHat can't reach its server right now."
      : status !== null && status >= 500
        ? "The server returned an error while loading this data."
        : status === 404
          ? "It may have been removed, or you may not have access to it."
          : status === 401
            ? "You're not signed in."
            : "Something went wrong while loading this data.";
  return (
    <div className={`error-state${compact ? " compact" : ""}`} role="alert">
      <span className="error-icon">
        <Icon name="alert" size={compact ? 16 : 20} />
      </span>
      <div className="stack-sm">
        <p className="error-title">{title}</p>
        <p className="muted">{description}</p>
        {IS_DEV && error instanceof Error ? (
          <p className="dev-detail">
            dev: {status !== null ? `HTTP ${status} · ` : ""}
            {error.message}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function NotFoundState({ what, backHref, backLabel }: { what: string; backHref: string; backLabel: string }) {
  return (
    <EmptyState
      icon="search"
      title={`${what} not found`}
      description="It may have been removed, or you may not have access to it."
      action={
        <Link className="btn" href={backHref}>
          {backLabel}
        </Link>
      }
    />
  );
}
