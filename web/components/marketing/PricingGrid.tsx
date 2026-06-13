import { cn } from "@/lib/cn";
import { PACKS } from "@/lib/pricing";
import { PricingCard } from "./PricingCard";

export function PricingGrid({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5",
        className,
      )}
    >
      {PACKS.map((pack) => (
        <PricingCard key={pack.id} pack={pack} />
      ))}
    </div>
  );
}
