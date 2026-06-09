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
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3",
        className,
      )}
    >
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="relative flex flex-col rounded-2xl border border-border bg-surface p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-accent">
              <step.Icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-mono text-muted">
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
