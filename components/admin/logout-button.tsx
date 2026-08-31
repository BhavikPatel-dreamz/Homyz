"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "@/components/ui/toast";

interface LogoutButtonProps {
  variant?: "button" | "menu-item" | "icon";
  className?: string;
  callbackUrl?: string;
  children?: React.ReactNode;
}

export function LogoutButton({
  variant = "button",
  className = "",
  callbackUrl = "/admin/login?logged_out=true",
  children,
}: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    // Provide immediate user feedback
    toast.info("Securing session and signing out...");

    try {
      await signOut({ callbackUrl });
    } catch (err: any) {
      toast.error("Logout failed. Please try again.");
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      {/* Button Render Variants */}
      {variant === "menu-item" ? (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all disabled:opacity-50 ${className}`}
        >
          {isLoggingOut ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          <span>{children || (isLoggingOut ? "Signing out..." : "Sign Out")}</span>
        </button>
      ) : variant === "icon" ? (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 ${className}`}
          title="Sign Out of Admin Console"
        >
          {isLoggingOut ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`rounded-full border border-[var(--border)] hover:bg-[var(--surface-secondary)] px-4 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-all inline-flex items-center gap-2 disabled:opacity-50 ${className}`}
        >
          {isLoggingOut && (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          <span>{children || (isLoggingOut ? "Signing out..." : "Sign out")}</span>
        </button>
      )}
    </>
  );
}
