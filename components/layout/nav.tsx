"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Signals" },
  { href: "/clv", label: "CLV" },
  { href: "/bets", label: "Bets" },
  { href: "/persistence", label: "Persistence" },
  { href: "/health", label: "Health" },
];


export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative px-3 py-1.5 text-sm rounded-md transition-colors",
              active
                ? "text-zinc-100 bg-zinc-800/80"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
