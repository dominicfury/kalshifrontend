import { Clock, ShieldQuestion } from "lucide-react";
import Image from "next/image";

import { LogoutButton } from "@/components/auth/logout-button";

export function PendingApproval({ username }: { username: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <Image
          src="/logo.png"
          alt="Sportsbetbrain"
          width={360}
          height={316}
          className="mx-auto h-32 w-auto opacity-80"
        />
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-6">
          <ShieldQuestion className="mx-auto size-10 text-amber-400" />
          <h1 className="mt-4 text-xl font-semibold text-zinc-50">
            Awaiting admin approval
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Your 12-hour trial has ended, <span className="text-zinc-100">{username}</span>.
            An admin needs to verify your account before you can continue.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-amber-300">
            <Clock className="size-3" />
            check back soon
          </div>
        </div>
        <LogoutButton variant="link" />
      </div>
    </div>
  );
}
