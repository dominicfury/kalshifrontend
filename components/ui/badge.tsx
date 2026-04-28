import { cn } from "@/lib/cn";

type Variant =
  | "default"
  | "muted"
  | "positive"
  | "negative"
  | "warning"
  | "info"
  | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  mono?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-zinc-800 text-zinc-200 border-zinc-700",
  muted: "bg-zinc-900 text-zinc-400 border-zinc-800",
  positive: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  negative: "bg-rose-500/15 text-rose-200 border-rose-500/40",
  warning: "bg-amber-500/15 text-amber-200 border-amber-500/40",
  info: "bg-sky-500/15 text-sky-200 border-sky-500/40",
  outline: "bg-transparent text-zinc-300 border-zinc-700",
};

export function Badge({
  children,
  variant = "default",
  className,
  mono,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
        VARIANT_CLASSES[variant],
        mono && "font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}
