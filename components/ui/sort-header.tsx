import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/cn";


interface SortHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  active: boolean;
  dir: "asc" | "desc";
  href: (sortKey: K, nextDir: "asc" | "desc") => string;
  align?: "left" | "right";
  // Default direction the first click on this column should produce.
  // Most numeric/time columns want "biggest/newest first" (desc); a few
  // (e.g. "Game in" — sort by event start ascending so the soonest game
  // is on top) want "smallest first" (asc). Defaults to desc.
  naturalDir?: "asc" | "desc";
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  active,
  dir,
  href,
  align = "left",
  naturalDir = "desc",
}: SortHeaderProps<K>) {
  const opposite: "asc" | "desc" = naturalDir === "desc" ? "asc" : "desc";
  const nextDir: "asc" | "desc" = active && dir === naturalDir ? opposite : naturalDir;
  return (
    <Link
      href={href(sortKey, nextDir)}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      {!active && <ChevronsUpDown className="size-3 opacity-40" />}
      {active && dir === "desc" && <ArrowDown className="size-3" />}
      {active && dir === "asc" && <ArrowUp className="size-3" />}
    </Link>
  );
}
