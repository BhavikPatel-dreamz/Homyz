"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import { changePasswordAction } from "@/actions/user/changePassword";

export function AdminSettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      setFeedback({
        tone: "success",
        msg: "Password updated successfully. Other active sessions were invalidated.",
      });
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
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
            />
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
              className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-6 py-2.5 text-xs font-bold text-[var(--accent-foreground)] transition-all shadow-2xs disabled:opacity-50"
            >
              {pending ? "Updating..." : "Update Password"}
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
