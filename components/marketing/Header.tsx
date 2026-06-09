import Link from "next/link";
import { Container, ButtonLink, buttonClass } from "@/components/ui";
import { SITE, NAV_LINKS } from "@/lib/site";

function Wordmark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Wordmark />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={buttonClass("ghost", "md", "hidden sm:inline-flex")}
          >
            Log in
          </Link>
          <ButtonLink href="/app/new" variant="primary" size="md">
            Upload your first image
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
