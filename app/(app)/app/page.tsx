import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { EmptyState } from "@/components/app/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { iconRuns, type IconRun } from "@/lib/db/schema";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Dashboard",
};

const STATUS_STYLES: Record<string, string> = {
  complete: "bg-primary/15 text-primary border-primary/30",
  generating: "bg-accent/15 text-accent border-accent/30",
  analyzing: "bg-accent/15 text-accent border-accent/30",
  ready: "bg-surface-2 text-foreground",
  created: "bg-surface-2 text-muted",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "";
  // stored as unix seconds
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function loadRuns(userId: string): Promise<IconRun[]> {
  try {
    return await getDb()
      .select()
      .from(iconRuns)
      .where(eq(iconRuns.userId, userId))
      .orderBy(desc(iconRuns.createdAt))
      .limit(10)
      .all();
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const runs = await loadRuns(user.id);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            You have{" "}
            <span className="font-medium text-foreground">
              {user.creditsBalance} credit{user.creditsBalance === 1 ? "" : "s"}
            </span>{" "}
            ready to spend.{" "}
            <Link
              href="/app/credits"
              className="font-medium text-accent transition-colors hover:text-foreground"
            >
              Buy credits
            </Link>
          </p>
        </div>
        <ButtonLink href="/app/new" size="lg" className="shrink-0">
          <span className="text-base leading-none">+</span> New icon pack
        </ButtonLink>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Recent runs
        </h2>

        {runs.length === 0 ? (
          <EmptyState
            title="No icon packs yet"
            description="Upload a design image and Asset Arsenal will detect the icon system and generate a matching pack."
            ctaHref="/app/new"
            ctaLabel="Create your first pack"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {runs.map((run) => (
              <Link key={run.id} href={`/app/runs/${run.id}`} className="group">
                <Card className="h-full transition-all group-hover:border-foreground/30 group-hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <Badge
                      className={cn(
                        "capitalize",
                        STATUS_STYLES[run.status] ?? "bg-surface-2 text-muted",
                      )}
                    >
                      {run.status}
                    </Badge>
                    <span className="text-xs text-muted">
                      {formatDate(run.createdAt)}
                    </span>
                  </div>
                  <p className="mt-5 text-xl font-semibold tracking-tight text-foreground">
                    {run.iconCount} icon{run.iconCount === 1 ? "" : "s"}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-muted">
                      {run.creditsSpent} credit
                      {run.creditsSpent === 1 ? "" : "s"} spent
                    </p>
                    <span className="text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      View →
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
