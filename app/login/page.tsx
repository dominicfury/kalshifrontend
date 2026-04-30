import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
        <LoginForm />
      </div>
    </div>
  );
}
