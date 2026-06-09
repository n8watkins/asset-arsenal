"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { SITE } from "@/lib/site";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/new", label: "New pack" },
  { href: "/app/credits", label: "Credits" },
  { href: "/app/settings", label: "Settings" },
];

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
      <div>
        <Link
          href="/app"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {SITE.name}
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="text-xs text-muted">Credit balance</p>
        <p className="text-2xl font-semibold text-foreground">
          {creditsBalance}
          <span className="ml-1 text-sm font-normal text-muted">credits</span>
        </p>
        <Link
          href="/app/credits"
          className="mt-1 inline-block text-xs text-accent hover:underline"
        >
          Buy more
        </Link>
      </div>

      <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item)
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:bg-surface-2/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-4">
        {userName && (
          <p className="truncate px-3 text-xs text-muted">{userName}</p>
        )}
        <Link
          href="/"
          className="block px-3 text-xs text-muted hover:text-foreground"
        >
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}
