import { cn } from "@/lib/cn";

interface SectionProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: SectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(eyebrow || title || description || actions) && (
        <div className="flex items-end justify-between gap-4">
          <div>
            {eyebrow && (
              <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="text-lg font-semibold tracking-tight text-zinc-50 mt-0.5">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-zinc-300">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}


export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/80 pb-5">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.16em] text-sky-300">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-zinc-300">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
