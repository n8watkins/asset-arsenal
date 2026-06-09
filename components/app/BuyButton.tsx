"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { PackId } from "@/lib/pricing";

export function BuyButton({
  packId,
  label = "Buy",
  disabled,
  disabledLabel,
}: {
  packId: PackId;
  label?: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) throw new Error("checkout failed");
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("no checkout url");
      }
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <Button className="w-full" variant="secondary" disabled>
        {disabledLabel ?? "Checkout not configured"}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={buy} disabled={busy}>
        {busy ? "Redirecting…" : label}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
