"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/ui/Icon";
import { useUnreadCount } from "@/lib/notifications/hooks";

import { isActive } from "./navigation";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "dashboard" },
  { href: "/my-work", label: "My Work", icon: "work" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
];

/** Phone-only bottom navigation (hidden above 900px by CSS). "More" opens the full menu as a sheet. */
export function MobileTabBar({ moreOpen, onMore }: { moreOpen: boolean; onMore: () => void }) {
  const pathname = usePathname();
  const { data: unread = 0 } = useUnreadCount();
  const onTab = TABS.some((tab) => isActive(pathname, tab.href));

  return (
    <nav className="tabbar" aria-label="Quick navigation">
      {TABS.map((tab) => {
        const active = !moreOpen && isActive(pathname, tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`tabbar-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="tabbar-icon">
              <Icon name={tab.icon} size={20} />
              {tab.href === "/notifications" && unread ? <span className="tabbar-badge">{unread > 99 ? "99+" : unread}</span> : null}
            </span>
            {tab.label}
          </Link>
        );
      })}
      <button
        type="button"
        className={`tabbar-item${moreOpen || !onTab ? " active" : ""}`}
        aria-expanded={moreOpen}
        aria-controls="app-sidebar"
        onClick={onMore}
      >
        <span className="tabbar-icon">
          <Icon name="menu" size={20} />
        </span>
        More
      </button>
    </nav>
  );
}
