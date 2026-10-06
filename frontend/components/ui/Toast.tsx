"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { Icon } from "./Icon";

type Toast = { id: number; kind: "success" | "error"; message: string };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            <Icon name={toast.kind === "success" ? "check" : "alert"} />
            <span>{toast.message}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Dismiss"
              onClick={() => setToasts((all) => all.filter((t) => t.id !== toast.id))}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
