import Image from "next/image";

import { SignupForm } from "@/components/auth/signup-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="Sportsbetbrain"
            width={2467}
            height={1194}
            priority
            className="h-32 w-auto"
          />
        </div>
        <SignupForm turnstileSiteKey={siteKey} />
      </div>
    </div>
  );
}
