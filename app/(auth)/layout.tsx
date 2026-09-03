import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="account-page flex min-h-screen flex-col justify-center bg-white text-zinc-900 font-sans">
      <main className="flex-1 flex flex-col justify-center bg-white">
        {children}
      </main>
    </div>
  );
}
