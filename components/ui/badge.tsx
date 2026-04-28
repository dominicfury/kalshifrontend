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
  positive: "bg-emerald-950/60 text-emerald-300 border-emerald-900/80",
  negative: "bg-rose-950/60 text-rose-300 border-rose-900/80",
  warning: "bg-amber-950/60 text-amber-300 border-amber-900/80",
  info: "bg-sky-950/60 text-sky-300 border-sky-900/80",
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
