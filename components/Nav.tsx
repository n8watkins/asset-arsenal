"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Single uniform navigation bar used on every page (home, gallery, bench).
// Brand (top-left) links home; the centered tabs highlight the active route.

type Tab = { href: string; label: string };

// Home is reached via the brand (top-left), so it's not a tab. Backlog is
// folded into /roadmap.
const TABS: Tab[] = [
  { href: "/gallery", label: "Gallery" },
  { href: "/bench-router", label: "Router" },
  { href: "/bench-s", label: "Bench S" },
  { href: "/bench", label: "Bench" },
  { href: "/bench-v2", label: "Bench V2" },
  { href: "/experiments", label: "Experiments" },
  { href: "/models", label: "Models" },
  { href: "/usage", label: "Usage" },
  { href: "/roadmap", label: "Roadmap" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4">
        {/* Left: brand → home */}
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-start text-xl font-semibold tracking-tight text-zinc-100 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg"
        >
          <span className="text-cyan-400">◆</span>
          Asset Arsenal
        </Link>

        {/* Center: primary navigation */}
        <nav className="flex items-center gap-1 justify-self-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-5 py-2 text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  active
                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: spacer keeps the centered nav truly centered */}
        <div className="justify-self-end" aria-hidden />
      </div>
    </header>
  );
}
