"use client";

import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/client";

export type FieldErrors = Record<string, string>;

/** Turns a server error into per-field messages plus a form-level message. */
export function serverErrors(error: unknown): { fields: FieldErrors; form: string | null } {
  if (error instanceof ApiError) {
    if (Object.keys(error.fieldErrors).length) {
      const { _: formLevel, ...fields } = error.fieldErrors;
      return { fields, form: formLevel ?? (Object.keys(fields).length ? null : error.message) };
    }
    return { fields: {}, form: error.message };
  }
  return { fields: {}, form: error instanceof Error ? error.message : "Something went wrong." };
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="required" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${htmlFor}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

export function FormActions({
  onCancel,
  submitLabel,
  submittingLabel,
  submitting,
  disabled,
}: {
  onCancel: () => void;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="form-actions">
      <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" className="btn primary" disabled={submitting || disabled}>
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}

/** Splits "Python, PyTorch" into a clean list. */
export const parseList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
