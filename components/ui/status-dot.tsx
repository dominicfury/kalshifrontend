import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "error" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-emerald-500 shadow-[0_0_10px_2px_rgba(16,185,129,0.45)]",
  warn: "bg-amber-500 shadow-[0_0_10px_2px_rgba(245,158,11,0.4)]",
  error: "bg-rose-500 shadow-[0_0_10px_2px_rgba(244,63,94,0.45)]",
  muted: "bg-zinc-600",
};

export function StatusDot({
  tone = "muted",
  pulse = false,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-block h-2 w-2 rounded-full",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-60 animate-ping",
            TONE_CLASSES[tone].split(" ")[0],
          )}
        />
      )}
    </span>
  );
}
