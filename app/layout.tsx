import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kalshi NHL +EV",
  description: "Live signals, CLV tracking, and bet log.",
};

const NAV = [
  { href: "/", label: "Signals" },
  { href: "/clv", label: "CLV" },
  { href: "/bets", label: "Bets" },
  { href: "/persistence", label: "Persistence" },
  { href: "/health", label: "Health" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-6 py-3 flex gap-6 text-sm">
          <span className="font-semibold tracking-tight">kalshi-nhl-ev</span>
          <nav className="flex gap-4 text-zinc-400">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-zinc-100">
                {n.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}
