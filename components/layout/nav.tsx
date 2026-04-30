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
  { href: "/clv", label: "CLV" },
  { href: "/health", label: "Health", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: true },
];


export default function Nav({ role }: { role: "user" | "admin" }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => !n.adminOnly || role === "admin");
  return (
    <nav className="flex items-center gap-1">
      {items.map((n) => {
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
