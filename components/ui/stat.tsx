import { cn } from "@/lib/cn";

interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warning" | "muted";
  icon?: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-zinc-100",
  positive: "text-emerald-400",
  negative: "text-rose-400",
  warning: "text-amber-400",
  muted: "text-zinc-400",
};

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
  className,
}: StatProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900",
        className,
      )}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-300">
        <span>{label}</span>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          TONE_CLASSES[tone],
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-300">{hint}</div>}
    </div>
  );
}
