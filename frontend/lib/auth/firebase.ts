// Real sign-in: "Sign in with GitHub" through Firebase Authentication.
//
// Active when NEXT_PUBLIC_AUTH_MODE=firebase. The browser keeps the Firebase
// session; every API call sends a fresh ID token as `Authorization: Bearer …`
// and the FastAPI backend verifies it (backend/app/auth.py). The Firebase web
// config below is public by design (it identifies the project, it isn't a secret).

import type { Auth, User } from "firebase/auth";

export const IS_FIREBASE_AUTH = process.env.NEXT_PUBLIC_AUTH_MODE === "firebase";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** undefined = Firebase hasn't told us yet; null = signed out. */
export type AuthState = User | null | undefined;

type Listener = () => void;
const listeners = new Set<Listener>();
let state: AuthState = undefined;
let authPromise: Promise<Auth> | null = null;

function loadAuth(): Promise<Auth> {
  // Loaded lazily so dev-mode builds never download the Firebase SDK.
  authPromise ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth, onIdTokenChanged }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    const app = getApps()[0] ?? initializeApp(config);
    const auth = getAuth(app);
    onIdTokenChanged(auth, (user) => {
      state = user;
      listeners.forEach((l) => l());
    });
    return auth;
  })();
  return authPromise;
}

export function subscribeAuth(listener: Listener): () => void {
  if (IS_FIREBASE_AUTH && typeof window !== "undefined") void loadAuth();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getAuthState = (): AuthState => state;

/** A valid ID token (Firebase refreshes it when it's close to expiring). */
export async function getIdToken(): Promise<string | null> {
  if (!IS_FIREBASE_AUTH) return null;
  const auth = await loadAuth();
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/** Opens GitHub's consent screen. Returns the GitHub username for display on Team. */
export async function signInWithGitHub(): Promise<string | null> {
  const auth = await loadAuth();
  const { GithubAuthProvider, signInWithPopup, getAdditionalUserInfo } = await import("firebase/auth");
  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  provider.addScope("user:email");
  const result = await signInWithPopup(auth, provider);
  return getAdditionalUserInfo(result)?.username ?? null;
}

export async function signOut(): Promise<void> {
  const auth = await loadAuth();
  await auth.signOut();
}

/** Turns Firebase error codes into sentences people can act on. */
export function signInErrorMessage(error: unknown): string | null {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (code === "auth/account-exists-with-different-credential")
    return "This email already signed in another way. Use the same method as before.";
  if (code === "auth/network-request-failed") return "Couldn't reach GitHub. Check your connection and try again.";
  if (code === "auth/unauthorized-domain") return "This web address isn't allowed to sign in yet. Ask a PM to add it in Firebase.";
  return "Sign-in didn't work. Please try again.";
}
