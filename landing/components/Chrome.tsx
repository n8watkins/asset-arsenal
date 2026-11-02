import Link from "next/link";
import { site } from "@/lib/site";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="7" fill="#f3b73f" />
        <path d="M9 23 16 8l7 15M11.5 18h9" fill="none" stroke="#1b1305" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {site.name}
    </Link>
  );
}

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#what-you-get", label: "What you get" },
  { href: "/#compare", label: "Compare" },
  { href: "/#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-6 text-sm text-muted md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>
        <a
          href={site.waitlistUrl}
          className="whitespace-nowrap rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink hover:brightness-110"
        >
          Join the waitlist
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          A concept by{" "}
          <a href={site.builderUrl} className="font-medium text-ink hover:text-accent">
            n8builds.dev
          </a>
          , built in public.
        </p>
        <div className="flex gap-5">
          <a href={site.waitlistUrl} className="hover:text-ink">
            Waitlist
          </a>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {site.updated}</p>
        <div className="mt-10 space-y-5 leading-relaxed text-ink/90 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
