import { cn } from "@/lib/cn";

export function DataTable({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/20",
        className,
      )}
      {...rest}
    >
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-zinc-800/80">{children}</tbody>;
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-zinc-900/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  mono = false,
  muted = false,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        mono && "font-mono tabular-nums",
        muted && "text-zinc-500",
        className,
      )}
    >
      {children}
    </td>
  );
}
