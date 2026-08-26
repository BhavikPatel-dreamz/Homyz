"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { Badge, secondaryButtonClass } from "./ui";

// Session-aware top nav for the authenticated area. Role links appear only for
// the roles that can use them (the real checks are server-side per page).
export function Nav() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const linkClass =
    "text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="font-semibold">
            homyz
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className={linkClass}>
              Dashboard
            </Link>
            <Link href="/bookings" className={linkClass}>
              Bookings
            </Link>
            {(role === "HOST" || role === "ADMIN") && (
              <Link href="/host/listings" className={linkClass}>
                My listings
              </Link>
            )}
            {role === "ADMIN" && (
              <Link href="/admin" className={linkClass}>
                Admin
              </Link>
            )}
            <Link href="/profile" className={linkClass}>
              Profile
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <span className="hidden items-center gap-2 text-sm text-zinc-500 sm:flex">
                {session.user.email}
                {role ? <Badge>{role}</Badge> : null}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className={secondaryButtonClass}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className={secondaryButtonClass}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
