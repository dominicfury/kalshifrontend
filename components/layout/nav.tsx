"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Signals" },
  { href: "/alerts", label: "Alerts" },
  { href: "/info", label: "How it works" },
  { href: "/clv", label: "CLV", adminOnly: true },
  { href: "/health", label: "Health", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: true },
];


export default function Nav({ role }: { role: "user" | "admin" }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || role === "admin");
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
              active
                ? "bg-zinc-800 text-zinc-50 shadow-sm shadow-black/20 ring-1 ring-zinc-700"
                : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50",
            )}
          >
            {n.label}
            {active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
