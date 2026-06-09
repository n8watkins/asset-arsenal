"use client";

/**
 * Dev-only login form. Calls the "credentials" provider with just an email
 * (no password). Rendered only in development by the login page. In production
 * the credentials provider is not registered, so this never appears.
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

export function DevLoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    await signIn("credentials", { email: email.trim(), redirectTo: "/app" });
    // On success NextAuth redirects; reset busy in case it returns.
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Dev login"}
      </Button>
    </form>
  );
}
