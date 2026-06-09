"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { FAQ_ITEMS, type FaqItem } from "./faq-data";

export { FAQ_ITEMS, type FaqItem };

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "h-5 w-5 shrink-0 text-muted transition-transform",
        open && "rotate-180 text-accent",
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function FAQ({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2/40"
            >
              <span className="text-base font-medium text-foreground">
                {item.q}
              </span>
              <ChevronIcon open={isOpen} />
            </button>
            <div
              className={cn(
                "grid transition-all duration-200",
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
