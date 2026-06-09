import type { Metadata } from "next";
import { Badge, Card } from "@/components/ui";
import { BuyButton } from "@/components/app/BuyButton";
import { getCurrentUser } from "@/lib/session";
import { features } from "@/lib/env";
import {
  PACKS,
  priceLabel,
  pricePerIconLabel,
  type Pack,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Credits",
};

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const stripeReady = features.stripe;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Credits
        </h1>
        <Card className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-muted">
            Current balance
          </span>
          <span className="text-4xl font-semibold text-foreground">
            {user.creditsBalance}
            <span className="ml-2 text-base font-normal text-muted">
              credits
            </span>
          </span>
          <span className="mt-1 text-sm text-muted">1 credit = 1 icon.</span>
        </Card>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Buy a pack
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PACKS.map((pack) => (
            <PackCard key={pack.id} pack={pack} stripeReady={stripeReady} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PackCard({ pack, stripeReady }: { pack: Pack; stripeReady: boolean }) {
  const isFree = pack.priceCents === 0;
  const perIcon = pricePerIconLabel(pack);

  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        pack.featured && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{pack.name}</h3>
        {pack.featured && <Badge className="border-primary/30 text-accent">Popular</Badge>}
      </div>

      <p className="mt-1 text-sm text-muted">{pack.tagline}</p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-foreground">
          {priceLabel(pack.priceCents)}
        </span>
        {perIcon && <span className="text-xs text-muted">{perIcon}</span>}
      </div>
      <p className="mt-1 text-sm text-foreground">{pack.credits} icons</p>

      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">
        {pack.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-accent">·</span>
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isFree ? (
          <Badge className="w-full justify-center py-2">
            Included on signup
          </Badge>
        ) : (
          <BuyButton
            packId={pack.id}
            label={`Buy ${pack.name}`}
            disabled={!stripeReady}
            disabledLabel="Checkout not configured"
          />
        )}
      </div>
    </Card>
  );
}
