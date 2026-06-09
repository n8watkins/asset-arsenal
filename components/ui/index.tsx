import Link from "next/link";
import { cn } from "@/lib/cn";

/* Shared UI kit. Plain Tailwind, dark theme tokens from globals.css. */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5", className)}>
      {children}
    </div>
  );
}

export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-20 sm:py-28", className)}>
      {children}
    </section>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "btn-primary-gradient text-primary-foreground hover:-translate-y-0.5",
  secondary:
    "border border-border bg-surface-2/70 text-foreground backdrop-blur-sm hover:border-primary/40 hover:bg-surface-2 hover:-translate-y-0.5",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2/60",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} className={buttonClass(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-sm transition-colors hover:border-primary/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
      {children}
    </p>
  );
}
