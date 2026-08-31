"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminManagementTabs() {
  const pathname = usePathname();
  const isInvitations = pathname.includes("/invitations");

  return (
    <div className="flex border-b border-[var(--border-subtle)] mb-6">
      <Link
        href="/admin/admins"
        className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
          !isInvitations
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Admin Users
      </Link>
      <Link
        href="/admin/admins/invitations"
        className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
          isInvitations
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Invitations
      </Link>
    </div>
  );
}
