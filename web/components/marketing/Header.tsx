"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container, ButtonLink, buttonClass } from "@/components/ui";
import { SITE, NAV_LINKS } from "@/lib/site";

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="group flex items-center gap-2.5 font-semibold tracking-tight text-foreground"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-bright to-primary text-primary-foreground shadow-[0_4px_16px_-4px_var(--primary)] transition-transform duration-200 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <path d="M13 16.5h7M16.5 13v7" />
        </svg>
      </span>
      {SITE.name}
    </Link>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Wordmark />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonClass("ghost", "md")}>
            Log in
          </Link>
          <ButtonLink href="/app/new" variant="primary" size="md">
            Upload your first image
          </ButtonLink>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-2/60 text-foreground transition-colors hover:border-primary/40 md:hidden"
        >
          <MenuIcon open={open} />
        </button>
      </Container>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="fixed inset-0 top-16 z-40 bg-background/60 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 top-16 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
            <Container className="flex flex-col gap-1 py-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-surface-2/60"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={close}
                className="rounded-lg px-3 py-3 text-base font-medium text-muted transition-colors hover:bg-surface-2/60 hover:text-foreground"
              >
                Log in
              </Link>
              <ButtonLink
                href="/app/new"
                variant="primary"
                size="lg"
                className="mt-2 w-full"
              >
                Upload your first image
              </ButtonLink>
            </Container>
          </div>
        </div>
      )}
    </header>
  );
}
