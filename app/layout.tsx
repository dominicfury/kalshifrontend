import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import LiveIndicator from "@/components/layout/live-indicator";
import Nav from "@/components/layout/nav";

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
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-950/30 via-transparent to-transparent" />

        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-2 group">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-sky-400/50 bg-sky-500/15 text-sm font-bold text-sky-200 shadow-[inset_0_0_12px_rgba(56,189,248,0.25)]">
                  K
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-tight text-zinc-50">
                    kalshi-nhl-ev
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-400">
                    +ev signal generator
                  </div>
                </div>
              </a>
              <Nav />
            </div>
            <Suspense fallback={null}>
              <LiveIndicator />
            </Suspense>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-6 py-8 space-y-8">
          {children}
        </main>

        <footer className="mx-auto max-w-[1400px] px-6 py-6 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          v0 · forward-tracking · trust the CLV
        </footer>
      </body>
    </html>
  );
}
