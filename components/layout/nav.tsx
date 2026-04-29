"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Signals" },
  { href: "/clv", label: "CLV" },
  { href: "/health", label: "Health" },
  { href: "/settings", label: "Settings" },
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
              "relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              active
                ? "text-zinc-50 bg-zinc-800"
                : "text-zinc-300 hover:text-zinc-50 hover:bg-zinc-900",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
