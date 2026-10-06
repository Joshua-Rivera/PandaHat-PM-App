"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { useUnreadCount } from "@/lib/notifications/hooks";

import { isActive, MANAGER_NAV, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "./navigation";
import { useSession } from "./Session";

function NavLink({ item, onNavigate, badge }: { item: NavItem; onNavigate: () => void; badge?: number }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} className={`nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      <Icon name={item.icon} />
      <span className="grow">{item.label}</span>
      {badge ? <span className="nav-badge">{badge > 99 ? "99+" : badge}</span> : null}
    </Link>
  );
}

export function AppSidebar({ open, hidden = false, onNavigate }: { open: boolean; hidden?: boolean; onNavigate: () => void }) {
  const { me } = useSession();
  const { data: unread = 0 } = useUnreadCount();

  return (
    <aside id="app-sidebar" className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation" inert={hidden}>
      <span className="sheet-handle" aria-hidden="true" />
      <Link href="/" className="brand" onClick={onNavigate}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo, no optimisation needed */}
        <img src="/pandahat-logo.webp" alt="" className="brand-logo" width={34} height={34} />
        <span className="brand-text">
          <span className="brand-name">PandaHat</span>
          <span className="brand-sub">Research Ops</span>
        </span>
      </Link>
      <nav className="nav">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
        {me.is_manager ? (
          <>
            <p className="nav-section">Manage</p>
            {MANAGER_NAV.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </>
        ) : null}
        <hr className="nav-divider" />
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} badge={item.href === "/notifications" ? unread : undefined} />
        ))}
      </nav>
    </aside>
  );
}
