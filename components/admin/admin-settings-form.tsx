"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import { changePasswordAction } from "@/actions/user/changePassword";

export function AdminSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Password rules checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!hasMinLength || !hasUppercase || !hasNumber) {
      setFeedback({
        tone: "error",
        msg: "New password does not meet complexity requirements.",
      });
      return;
    }

    if (!passwordsMatch) {
      setFeedback({ tone: "error", msg: "Passwords do not match." });
      return;
    }

    startTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
      });

      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ tone: "success", msg: "Your password has been changed successfully!" });
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-sans text-[var(--foreground)]">
      {/* Change Password Card */}
      <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <h2 className="text-base font-bold text-[var(--foreground)] mb-1">
          Change Administrator Password
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mb-6">
          Update your administrative password. Changing your password invalidates all other active sessions.
        </p>

        {feedback && (
          <div className="mb-4">
            <Alert tone={feedback.tone}>{feedback.msg}</Alert>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-lg">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Current Password *
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                aria-label="Toggle current password visibility"
              >
                {showCurrentPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              New Password *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                aria-label="Toggle new password visibility"
              >
                {showNewPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Password policy indicator */}
          <div className="rounded-xl bg-[var(--surface-secondary)] p-3.5 text-[11px] text-[var(--muted-foreground)] flex flex-col gap-1.5 border border-[var(--border-subtle)]">
            <div className="font-bold text-[var(--foreground)] mb-0.5">
              Password Requirements:
            </div>
            <div className="flex items-center gap-2">
              <span className={hasMinLength ? "text-emerald-600 font-extrabold" : "text-[var(--muted-foreground)] opacity-40"}>
                {hasMinLength ? "✓" : "○"}
              </span>
              <span>Minimum 8 characters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasUppercase ? "text-emerald-600 font-extrabold" : "text-[var(--muted-foreground)] opacity-40"}>
                {hasUppercase ? "✓" : "○"}
              </span>
              <span>At least one uppercase letter (A-Z)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasNumber ? "text-emerald-600 font-extrabold" : "text-[var(--muted-foreground)] opacity-40"}>
                {hasNumber ? "✓" : "○"}
              </span>
              <span>At least one number (0-9)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={passwordsMatch ? "text-emerald-600 font-extrabold" : "text-[var(--muted-foreground)] opacity-40"}>
                {passwordsMatch ? "✓" : "○"}
              </span>
              <span>Passwords match</span>
            </div>
          </div>

          <div className="mt-2">
            <button
              type="submit"
              disabled={pending || !hasMinLength || !hasUppercase || !hasNumber || !passwordsMatch}
              className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-6 py-2.5 text-xs font-bold text-[var(--accent-foreground)] transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-2"
            >
              {pending && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <span>{pending ? "Updating..." : "Update Password"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security Policies Sidebar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs flex flex-col gap-4 text-xs">
        <h3 className="text-sm font-bold text-[var(--foreground)]">
          Environment & Security Parameters
        </h3>

        <div className="flex flex-col gap-2.5 text-[var(--muted-foreground)] leading-relaxed">
          <div>
            <strong className="text-[var(--foreground)] font-semibold">Access Token TTL:</strong> 900 seconds (15 min)
          </div>
          <div>
            <strong className="text-[var(--foreground)] font-semibold">Refresh Token TTL:</strong> 30 days (auto-rotated)
          </div>
          <div>
            <strong className="text-[var(--foreground)] font-semibold">Rate Limiter Window:</strong> 15 minutes
          </div>
          <div>
            <strong className="text-[var(--foreground)] font-semibold">Max Login Failures:</strong> 10 attempts
          </div>
          <div>
            <strong className="text-[var(--foreground)] font-semibold">OTP Code Lifespan:</strong> 5 minutes (capped to 5 attempts)
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[var(--muted-foreground)] text-[11px]">
          Security configurations are dynamically managed via environment variables and applied with strict server-side validation.
        </div>
      </div>
    </div>
  );
}
