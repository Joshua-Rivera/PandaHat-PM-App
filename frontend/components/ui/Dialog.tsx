"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "./Icon";

/** Native <dialog>: focus trapping, Escape-to-close and the backdrop come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? " wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open ? (
        <div className="dialog-body">
          <header className="dialog-header">
            <div>
              <h2 id="dialog-title">{title}</h2>
              {description ? <p className="muted">{description}</p> : null}
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <Icon name="close" />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
