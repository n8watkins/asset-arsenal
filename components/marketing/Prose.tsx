import { cn } from "@/lib/cn";

/**
 * Manual prose styling for legal/long-form pages (no @tailwindcss/typography
 * installed). Styles headings, paragraphs, lists, and links of nested content
 * via arbitrary descendant selectors.
 */
export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-w-none text-[15px] leading-relaxed text-muted",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground",
        "[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:my-4",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
        "[&_li]:pl-1",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Standard header block for legal pages. */
export function LegalHeader({
  title,
  updated,
}: {
  title: string;
  updated: string;
}) {
  return (
    <div className="mb-8 border-b border-border pb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted">Last updated: {updated}</p>
    </div>
  );
}
