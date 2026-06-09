import type { Metadata } from "next";
import { Button, Card } from "@/components/ui";
import { getCurrentUser, isDemo } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings",
};

async function signOutAction() {
  "use server";
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirectTo: "/" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your account and data preferences.
        </p>
      </header>

      <Card className="space-y-5">
        <div className="flex items-center gap-4 border-b border-border pb-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-semibold text-foreground ring-1 ring-border">
            {(user.name ?? "AA")
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("") || "AA"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {user.name ?? "Demo User"}
            </p>
            <p className="truncate text-sm text-muted">{user.email ?? "—"}</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" value={user.name ?? "—"} />
          <Field label="Email" value={user.email ?? "—"} />
          <Field
            label="Credit balance"
            value={`${user.creditsBalance} credits`}
          />
          <Field label="Account type" value={user.isAdmin ? "Admin" : "Member"} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Data &amp; retention
        </h2>
        <p className="text-sm text-muted">
          Source images and generated icons are stored so you can re-download
          your packs. Generated assets are yours to use. To request deletion of
          your account and associated data, contact support.
        </p>
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Sign out</h2>
          <p className="text-xs text-muted">End your session on this device.</p>
        </div>
        {isDemo ? (
          <Button variant="secondary" disabled>
            Sign out
          </Button>
        ) : (
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
