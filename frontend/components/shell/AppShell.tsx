"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AppSidebar } from "./AppSidebar";
import { MobileTabBar } from "./MobileTabBar";
import { RoleSwitcher } from "./RoleSwitcher";
import { SessionGate } from "./Session";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <ShellLayout>{children}</ShellLayout>
    </SessionGate>
  );
}

const PHONE_QUERY = "(max-width: 900px)";

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsPhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

function ShellLayout({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const isPhone = useIsPhone();
  useEffect(() => setNavOpen(false), [pathname]);

  // On phones the sidebar is a bottom sheet: Esc closes it, the page behind can't
  // scroll, and focus moves into it so keyboard and screen-reader users land there.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>("#app-sidebar a, #app-sidebar button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppSidebar open={navOpen} hidden={isPhone && !navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen ? <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" /> : null}
      <div className="main-col">
        <header className="topbar">
          <Link href="/" className="topbar-brand" aria-label="PandaHat home">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo */}
            <img src="/pandahat-logo.webp" alt="" width={32} height={32} />
          </Link>
          <div className="grow" />
          <RoleSwitcher />
          <NotificationBell />
          <UserMenu />
        </header>
        <main id="main" className="content">
          {children}
        </main>
      </div>
      <MobileTabBar moreOpen={navOpen} onMore={() => setNavOpen((v) => !v)} />
    </div>
  );
}
