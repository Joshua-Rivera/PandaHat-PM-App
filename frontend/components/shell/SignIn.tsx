"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { recordGithubLogin } from "@/lib/api/endpoints";
import { signInErrorMessage, signInWithGitHub, signOut } from "@/lib/auth/firebase";
import type { Me } from "@/lib/api/types";

import { Icon } from "@/components/ui/Icon";

function Brand() {
  return (
    <div className="signin-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pandahat-logo.webp" alt="" width={44} height={44} />
      <span>
        <span className="brand-name">PandaHat</span>
        <span className="brand-sub">Research Ops</span>
      </span>
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** Shown to anyone who isn't signed in when NEXT_PUBLIC_AUTH_MODE=firebase. */
export function SignInScreen({ notice }: { notice?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const login = await signInWithGitHub();
      queryClient.clear();
      if (login) void recordGithubLogin(login).catch(() => undefined); // cosmetic; never block sign-in on it
    } catch (e) {
      setError(signInErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen signin-screen">
      <div className="card identity-card signin-card">
        <Brand />
        <div className="stack-sm">
          <h1>Sign in to see your work</h1>
          <p className="muted">
            Use the GitHub account you use in the Adversarial-Fall-2026 organisation. Your tasks, deadlines and learning
            path are all here, so you don&apos;t have to dig through GitHub.
          </p>
          {notice ? <p className="form-error">{notice}</p> : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn github-btn" onClick={signIn} disabled={busy}>
          <GitHubMark /> {busy ? "Waiting for GitHub…" : "Sign in with GitHub"}
        </button>
        <p className="muted small">We only read your public profile and email address.</p>
      </div>
    </div>
  );
}

/** Signed in with GitHub, but no PM has approved the account yet. */
export function PendingApprovalScreen({ me, onRefresh }: { me: Me; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  return (
    <div className="center-screen signin-screen">
      <div className="card identity-card signin-card">
        <Brand />
        <div className="stack-sm">
          <span className="badge-pill tone-warning signin-status">
            <Icon name="clock" size={14} /> Waiting for approval
          </span>
          <h1>Thanks, {me.display_name.split(" ")[0]}!</h1>
          <p className="muted">
            Your GitHub account ({me.email}) isn&apos;t on the team list yet. A project manager will approve you and set
            your track (Learning Path or Research) and commitment. Check back soon.
          </p>
        </div>
        <div className="row gap-sm wrap">
          <button type="button" className="btn primary" onClick={onRefresh}>
            Check again
          </button>
          <button type="button" className="btn" onClick={() => void signOut().then(() => queryClient.clear())}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
