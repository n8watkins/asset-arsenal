import { ButtonLink } from "@/components/ui";

export function EmptyState({
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Illustration: a grid of icon tiles */}
      <div className="relative mb-6 grid grid-cols-3 gap-2.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <span
            key={i}
            className={
              i === 4
                ? "flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted"
            }
          >
            {i === 4 ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="10" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            )}
          </span>
        ))}
      </div>

      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      )}
      {ctaHref && ctaLabel && (
        <ButtonLink href={ctaHref} size="lg" className="mt-7">
          {ctaLabel}
        </ButtonLink>
      )}
    </div>
  );
}
