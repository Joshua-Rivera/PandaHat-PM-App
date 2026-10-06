"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { IS_FIREBASE_AUTH, signOut } from "@/lib/auth/firebase";
import { IS_DEV_AUTH } from "@/lib/dev/devIdentity";
import { COMMITMENT_SHORT, RESEARCH_STATUS_LABEL, ROLE_LABEL } from "@/lib/format";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Primitives";

import { useSession } from "./Session";

export function UserMenu() {
  const { me, switchIdentity } = useSession();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={ref}>
      <button type="button" className="user-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Avatar name={me.display_name} />
        <span className="user-name">{me.display_name}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open ? (
        <div className="popover user-popover" role="menu">
          <div className="popover-section">
            <strong>{me.display_name}</strong>
            <span className="muted small">{me.email}</span>
            <span className="muted small">
              {ROLE_LABEL[me.role]}
              {me.role === "researcher" ? ` · ${RESEARCH_STATUS_LABEL[me.research_status]} · ${COMMITMENT_SHORT[me.commitment]}` : ""}
            </span>
          </div>
          <Link href="/settings" role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
            <Icon name="settings" /> Settings
          </Link>
          {IS_DEV_AUTH ? (
            <button type="button" role="menuitem" className="menu-item" onClick={() => switchIdentity(null)}>
              <Icon name="users" /> Choose a different user (dev)
            </button>
          ) : null}
          {IS_FIREBASE_AUTH ? (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => void signOut().then(() => queryClient.clear())}
            >
              <Icon name="close" /> Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
