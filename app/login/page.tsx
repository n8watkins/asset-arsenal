import type { Metadata } from "next";
import Link from "next/link";
import { Button, ButtonLink, Card } from "@/components/ui";
import { SITE } from "@/lib/site";
import { features } from "@/lib/env";

export const metadata: Metadata = {
  title: "Log in",
};

async function signInWithGoogle() {
  "use server";
  const { signIn } = await import("@/lib/auth");
  await signIn("google", { redirectTo: "/app" });
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const authConfigured = features.auth;

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-5 py-16">
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />
      <Card className="relative w-full max-w-md p-8 text-center">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="1.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9.5" y="1.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="1.5" y="9.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            {SITE.name}
          </span>
        </Link>
        <p className="mb-8 text-sm text-muted">
          Turn design images into reusable icon packs.
        </p>

        {authConfigured ? (
          <form action={signInWithGoogle}>
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              <GoogleGlyph />
              Continue with Google
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              disabled
            >
              <GoogleGlyph />
              Continue with Google
            </Button>
            <p className="text-xs text-muted">
              Auth not configured — using demo mode.
            </p>
            <ButtonLink href="/app" variant="primary" size="md" className="w-full">
              Enter demo app
            </ButtonLink>
          </div>
        )}

        <p className="mt-8 text-xs text-muted">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </Card>
    </main>
  );
}
