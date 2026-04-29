import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
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
  title: "I'm Gone x3",
  description: "Live +EV signals and CLV tracking.",
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
              <a href="/" className="flex items-center group" aria-label="I'm Gone x3 home">
                <Image
                  src="/logo.png"
                  alt="I'm Gone x3"
                  width={1178}
                  height={1135}
                  priority
                  className="h-14 w-auto"
                />
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
