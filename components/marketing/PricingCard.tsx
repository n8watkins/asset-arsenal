import { cn } from "@/lib/cn";
import { ButtonLink, Badge } from "@/components/ui";
import {
  priceLabel,
  pricePerIconLabel,
  type Pack,
} from "@/lib/pricing";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function PricingCard({ pack }: { pack: Pack }) {
  const featured = Boolean(pack.featured);
  const perIcon = pricePerIconLabel(pack);
  const isFree = pack.priceCents === 0;
  const href = isFree ? "/app/new" : `/app/credits?pack=${pack.id}`;
  const cta = isFree ? "Start free" : `Get ${pack.name}`;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl p-6 transition-all duration-200",
        featured
          ? "featured-ring inner-glow bg-gradient-to-b from-surface-2 to-surface"
          : "border border-border bg-surface hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
      )}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <Badge className="border-primary/50 bg-primary/20 text-foreground shadow-[0_4px_16px_-6px_var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            Most popular
          </Badge>
        </div>
      )}

      <div className="relative mb-4">
        <h3 className="text-lg font-semibold text-foreground">{pack.name}</h3>
        <p className="mt-1 text-sm text-muted">{pack.tagline}</p>
      </div>

      <div className="relative mb-1 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-4xl font-bold tracking-tight",
            featured ? "text-gradient" : "text-foreground",
          )}
        >
          {priceLabel(pack.priceCents)}
        </span>
        {!isFree && <span className="text-sm text-muted">one-time</span>}
      </div>
      <p className="relative mb-5 text-sm text-muted">
        {pack.credits} icons{perIcon ? ` · ${perIcon}` : ""}
      </p>

      <ButtonLink
        href={href}
        variant={featured ? "primary" : "secondary"}
        size="md"
        className="relative w-full"
      >
        {cta}
      </ButtonLink>

      <ul className="relative mt-6 space-y-2.5">
        {pack.features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-foreground/90">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
