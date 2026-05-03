import { Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SignupForm } from "@/components/auth/signup-form";
import { getBool, KNOWN_KEYS } from "@/lib/system-config";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const signupsOpen = await getBool(KNOWN_KEYS.SIGNUPS_ENABLED, true);
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="Sportsbetbrain"
            width={474}
            height={530}
            priority
            className="h-32 w-auto sm:h-48"
          />
        </div>
        {signupsOpen ? (
          <SignupForm turnstileSiteKey={siteKey} />
        ) : (
          <SignupsClosedCard />
        )}
      </div>
    </div>
  );
}

function SignupsClosedCard() {
  return (
    <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-900/60 p-6 text-center shadow-2xl backdrop-blur">
      <div className="mx-auto inline-flex size-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700">
        <Lock className="size-5" />
      </div>
      <h1 className="text-base font-semibold text-zinc-100">
        Signups are currently closed
      </h1>
      <p className="text-xs leading-relaxed text-zinc-400">
        New accounts aren&apos;t being accepted at the moment. If you already
        have an account, you can still log in.
      </p>
      <Link
        href="/login"
        className="inline-flex w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
      >
        Go to log in
      </Link>
    </div>
  );
}
