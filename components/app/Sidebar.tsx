"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SITE } from "@/lib/site";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
  icon: React.ReactNode;
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCoin() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.75v6.5M6.25 6.25h2.25a1.25 1.25 0 0 1 0 2.5H6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", exact: true, icon: <IconGrid /> },
  { href: "/app/new", label: "New pack", icon: <IconPlus /> },
  { href: "/app/credits", label: "Credits", icon: <IconCoin /> },
  { href: "/app/settings", label: "Settings", icon: <IconGear /> },
];

function initials(name: string | null): string {
  if (!name) return "AA";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AA";
}

export function Sidebar({
  userName,
  creditsBalance,
}: {
  userName: string | null;
  creditsBalance: number;
}) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <aside className="flex w-full flex-col gap-6 border-b border-border bg-surface p-5 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      {/* Brand */}
      <Link
        href="/app"
        className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <IconGrid />
        </span>
        <span className="text-base font-semibold tracking-tight">
          {SITE.name}
        </span>
      </Link>

      {/* Credit balance card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2 px-4 py-3.5">
        <div
          className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl"
          aria-hidden="true"
        />
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Credit balance
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="bg-gradient-to-br from-foreground to-accent bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            {creditsBalance}
          </span>
          <span className="text-xs font-medium text-muted">credits</span>
        </p>
        <Link
          href="/app/credits"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-foreground"
        >
          Buy more
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-2 text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted hover:bg-surface-2/60 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "transition-colors",
                  active ? "text-accent" : "text-muted group-hover:text-foreground",
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-foreground ring-1 ring-border">
            {initials(userName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {userName ?? "Demo User"}
            </p>
            <Link
              href="/"
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
