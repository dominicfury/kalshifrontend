import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  hint,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-10 text-center",
        className,
      )}
    >
      <div className="text-base font-medium text-zinc-200">{title}</div>
      {description && (
        <div className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
          {description}
        </div>
      )}
      {hint && <div className="mt-4 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
