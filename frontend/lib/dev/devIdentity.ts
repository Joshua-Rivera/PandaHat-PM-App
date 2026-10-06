// DEVELOPMENT ONLY — the "Viewing as" identity.
//
// The backend's AUTH_MODE=dev trusts an X-Dev-User-Id header. This module is the
// only place that decides which id is sent. It is inert unless
// NEXT_PUBLIC_AUTH_MODE=dev, so a production build (which won't set it) never
// sends the header, and the backend refuses AUTH_MODE=dev in production anyway.

export const IS_DEV_AUTH = process.env.NEXT_PUBLIC_AUTH_MODE === "dev";

const STORAGE_KEY = "pandahat.devUserId";
const ENV_DEFAULT = process.env.NEXT_PUBLIC_DEV_USER_ID || null;

type Listener = () => void;
const listeners = new Set<Listener>();
let current: string | null | undefined; // undefined = not read from storage yet

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private mode / blocked storage: fall back to the env default
  }
}

export function getDevUserId(): string | null {
  if (!IS_DEV_AUTH || typeof window === "undefined") return null;
  if (current === undefined) current = readStorage() ?? ENV_DEFAULT;
  return current;
}

export function setDevUserId(userId: string | null): void {
  if (!IS_DEV_AUTH) return;
  current = userId;
  try {
    if (userId) window.localStorage.setItem(STORAGE_KEY, userId);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the choice still holds for this tab.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeDevUserId(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
