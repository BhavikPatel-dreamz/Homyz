import type { ReactNode } from "react";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthFooter } from "@/components/auth/auth-footer";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 font-sans">
      <AuthHeader />
      <main className="flex-1 flex flex-col justify-center bg-white">
        {children}
      </main>
      <AuthFooter />
    </div>
  );
}
