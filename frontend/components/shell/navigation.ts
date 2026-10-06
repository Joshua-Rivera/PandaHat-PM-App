import type { IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName; managerOnly?: boolean };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/my-work", label: "My Work", icon: "work" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/availability", label: "Availability", icon: "clock" },
];

export const MANAGER_NAV: NavItem[] = [
  { href: "/team", label: "Team", icon: "users", managerOnly: true },
  { href: "/team-availability", label: "Team Availability", icon: "calendar", managerOnly: true },
  { href: "/workload", label: "Workload", icon: "gauge", managerOnly: true },
  { href: "/projects/manage", label: "Manage Projects", icon: "kanban", managerOnly: true },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/projects") return pathname === "/projects" || (pathname.startsWith("/projects/") && !pathname.startsWith("/projects/manage"));
  return pathname === href || pathname.startsWith(`${href}/`);
}
