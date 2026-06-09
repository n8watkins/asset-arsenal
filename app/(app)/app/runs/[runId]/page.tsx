import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { EmptyState } from "@/components/app/EmptyState";
import { getCurrentUser } from "@/lib/session";
import { features } from "@/lib/env";
import { getDb } from "@/lib/db";
import {
  generatedIcons,
  iconRuns,
  type GeneratedIcon,
  type IconRun,
} from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Run",
};

interface ManifestEntry {
  key?: string;
  name?: string;
  concept?: string;
}

async function loadRun(
  runId: string,
  userId: string,
): Promise<{ run: IconRun; icons: GeneratedIcon[] } | null> {
  if (!features.db) return null;
  try {
    const db = getDb();
    const run = await db
      .select()
      .from(iconRuns)
      .where(and(eq(iconRuns.id, runId), eq(iconRuns.userId, userId)))
      .get();
    if (!run) return null;
    const icons = await db
      .select()
      .from(generatedIcons)
      .where(eq(generatedIcons.runId, runId))
      .orderBy(asc(generatedIcons.createdAt))
      .all();
    return { run, icons };
  } catch {
    return null;
  }
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const data = await loadRun(runId, user.id);

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <BackLink />
        <EmptyState
          title="Run not available"
          description={
            features.db
              ? "We couldn't find this run, or it doesn't belong to your account."
              : "This is demo mode — runs aren't persisted without a database configured."
          }
          ctaHref="/app/new"
          ctaLabel="Start a new pack"
        />
      </div>
    );
  }

  const { run, icons } = data;
  const manifest = (run.iconManifest as ManifestEntry[] | null) ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <BackLink />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Icon run
          </h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            <Badge>{run.status}</Badge>
            <span>
              {run.iconCount} icon{run.iconCount === 1 ? "" : "s"}
            </span>
            <span>· {run.creditsSpent} credits spent</span>
          </div>
        </div>
        <ButtonLink href={`/api/runs/${run.id}/export`} variant="secondary">
          Download ZIP
        </ButtonLink>
      </header>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <Card>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
            Source image
          </h2>
          {run.sourceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={run.sourceImageUrl}
              alt="Source"
              className="w-full rounded-lg border border-border object-contain"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
              No source preview
            </div>
          )}

          {manifest.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
                Manifest
              </h3>
              <ul className="space-y-1 text-sm text-foreground">
                {manifest.map((m, i) => (
                  <li key={m.key ?? i} className="truncate">
                    {m.name ?? m.key ?? `Icon ${i + 1}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted">
            Generated icons
          </h2>
          {icons.length === 0 ? (
            <EmptyState
              title="No generated icons yet"
              description="Icons will appear here once generation completes."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {icons.map((icon) => (
                <div
                  key={icon.id}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 p-4 text-center"
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                    {icon.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={icon.imageUrl}
                        alt={icon.iconName ?? "icon"}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted">
                        {icon.status === "failed" ? "failed" : "pending"}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs font-medium text-foreground">
                    {icon.iconName ?? icon.iconKey ?? "Icon"}
                  </p>
                  {icon.imageUrl && (
                    <a
                      href={icon.imageUrl}
                      download={`${icon.iconName ?? icon.iconKey ?? "icon"}.png`}
                      className="text-xs text-accent hover:underline"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/app"
      className="inline-block text-sm text-muted hover:text-foreground"
    >
      ← Back to dashboard
    </Link>
  );
}
