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
  default: "bg-zinc-800 text-zinc-100 border-zinc-600",
  muted: "bg-zinc-800/80 text-zinc-200 border-zinc-700",
  positive: "bg-emerald-500/20 text-emerald-100 border-emerald-400/50",
  negative: "bg-rose-500/20 text-rose-100 border-rose-400/50",
  warning: "bg-amber-500/20 text-amber-100 border-amber-400/50",
  info: "bg-sky-500/20 text-sky-100 border-sky-400/50",
  outline: "bg-transparent text-zinc-200 border-zinc-600",
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
