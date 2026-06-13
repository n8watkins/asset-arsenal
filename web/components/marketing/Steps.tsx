import { cn } from "@/lib/cn";
import {
  ImageIcon,
  SparkleIcon,
  CheckListIcon,
  GridIcon,
  DownloadIcon,
  type Glyph,
} from "./icons";

const STEPS: { title: string; body: string; Icon: Glyph }[] = [
  {
    title: "Upload your design image",
    body: "Drop in a dashboard, app mockup, SaaS concept, or brand image — anything with an icon style you like.",
    Icon: ImageIcon,
  },
  {
    title: "AI finds the icons",
    body: "We detect the icon system in your image and read its style: stroke weight, corners, fill, and vibe.",
    Icon: SparkleIcon,
  },
  {
    title: "Review the icon list",
    body: "See every icon we spotted plus suggestions to round out the set. Add, rename, or remove before generating.",
    Icon: CheckListIcon,
  },
  {
    title: "Generate the matching pack",
    body: "We recreate each icon in your matched style, in bulk — one credit per icon, consistent across the set.",
    Icon: GridIcon,
  },
  {
    title: "Download your assets",
    body: "Grab individual PNGs or the full ZIP, with prompt and manifest metadata for every icon.",
    Icon: DownloadIcon,
  },
];

export function Steps({ className }: { className?: string }) {
  return (
    <ol
      className={cn(
        "relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3",
        className,
      )}
    >
      {/* Connecting line across the row (large screens). */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-[2.65rem] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
      />
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="group relative flex flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/20 to-surface-2 text-accent shadow-[0_0_18px_-6px_var(--primary)] transition-transform duration-200 group-hover:scale-105">
              <step.Icon className="h-5 w-5" />
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background font-mono text-xs font-semibold text-muted transition-colors group-hover:border-accent/40 group-hover:text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
          <h3 className="mb-1.5 text-base font-semibold text-foreground">
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
