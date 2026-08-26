import Link from "next/link";
import type { ReactNode } from "react";

// Layout for the auth pages (login, register, verify, forgot/reset password).
// No authentication required.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 block text-center text-xl font-semibold text-zinc-900 dark:text-zinc-50"
        >
          homyz
        </Link>
        {children}
      </div>
    </div>
  );
}
