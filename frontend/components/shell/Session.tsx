"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

import { ApiError } from "@/lib/api/client";
import type { Me } from "@/lib/api/types";
import { getAuthState, IS_FIREBASE_AUTH, subscribeAuth } from "@/lib/auth/firebase";
import { getDevUserId, IS_DEV_AUTH, setDevUserId, subscribeDevUserId } from "@/lib/dev/devIdentity";
import { useMe } from "@/lib/queries";

import { ErrorState } from "@/components/ui/States";

import { ChooseIdentity } from "./ChooseIdentity";
import { ShellSkeleton } from "./ShellSkeleton";
import { PendingApprovalScreen, SignInScreen } from "./SignIn";

type Session = { me: Me; switchIdentity: (userId: string | null) => void };
const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionGate>");
  return session;
}

export function useDevUserId(): string | null {
  return useSyncExternalStore(subscribeDevUserId, getDevUserId, () => null);
}

export function useSwitchIdentity() {
  const queryClient = useQueryClient();
  return useCallback(
    (userId: string | null) => {
      // Query keys don't include the user, so drop every cached response
      // before acting as someone else: no data leaks between identities.
      queryClient.clear();
      setDevUserId(userId);
    },
    [queryClient],
  );
}

/** Renders children only once we know who the user is (and their role). */
export function SessionGate({ children }: { children: ReactNode }) {
  return IS_FIREBASE_AUTH ? <FirebaseSessionGate>{children}</FirebaseSessionGate> : <DevSessionGate>{children}</DevSessionGate>;
}

function FirebaseSessionGate({ children }: { children: ReactNode }) {
  const firebaseUser = useSyncExternalStore(subscribeAuth, getAuthState, () => undefined);
  const uid = firebaseUser?.uid ?? null;
  const me = useMe(!!uid);
  const switchIdentity = useCallback(() => undefined, []);

  if (firebaseUser === undefined) return <ShellSkeleton />;
  if (firebaseUser === null) return <SignInScreen />;
  if (me.isPending) return <ShellSkeleton />;
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <SignInScreen notice="Your session expired. Sign in again." />;
    if (me.error instanceof ApiError && me.error.status === 403) return <SignInScreen notice={me.error.message} />;
    return (
      <div className="center-screen">
        <ErrorState title="Couldn't load your profile" error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  }
  if (me.data.access_status === "PENDING") return <PendingApprovalScreen me={me.data} onRefresh={() => me.refetch()} />;
  return <SessionContext.Provider value={{ me: me.data, switchIdentity }}>{children}</SessionContext.Provider>;
}

function DevSessionGate({ children }: { children: ReactNode }) {
  const devUserId = useDevUserId();
  const hydrated = useSyncExternalStore(subscribeDevUserId, () => true, () => false);
  const switchIdentity = useSwitchIdentity();
  const needsIdentity = IS_DEV_AUTH && !devUserId;
  const me = useMe(hydrated && !needsIdentity);

  if (!hydrated) return <ShellSkeleton />;
  if (needsIdentity) return <ChooseIdentity onChoose={switchIdentity} />;
  if (me.isPending) return <ShellSkeleton />;
  if (me.isError) {
    if (IS_DEV_AUTH && me.error instanceof ApiError && me.error.status === 401) {
      // The stored dev identity no longer exists (e.g. the database was reset).
      return <ChooseIdentity onChoose={switchIdentity} notice="That user no longer exists. Choose someone else." />;
    }
    return (
      <div className="center-screen">
        <ErrorState title="Couldn't load your profile" error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  }
  return <SessionContext.Provider value={{ me: me.data, switchIdentity }}>{children}</SessionContext.Provider>;
}
