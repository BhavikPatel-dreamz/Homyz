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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Change Password Card */}
      <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs ">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">
          Change Administrator Password
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          Update your administrative password. Changing your password invalidates all other active sessions.
        </p>

        {feedback && (
          <div className="mb-4">
            <Alert tone={feedback.tone}>{feedback.msg}</Alert>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-lg">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-700 ">
              Current Password *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-700 ">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-700 ">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-600 "
            />
          </div>

          {/* Password policy indicator */}
          <div className="rounded-xl bg-zinc-50 p-3 text-[11px] text-zinc-600 flex flex-col gap-1">
            <div className="font-semibold text-zinc-800 mb-1">
              Password Requirements:
            </div>
            <div className="flex items-center gap-2">
              <span className={hasMinLength ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                {hasMinLength ? "✓" : "○"}
              </span>
              <span>Minimum 8 characters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasUppercase ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                {hasUppercase ? "✓" : "○"}
              </span>
              <span>At least one uppercase letter (A-Z)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasNumber ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                {hasNumber ? "✓" : "○"}
              </span>
              <span>At least one number (0-9)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={passwordsMatch ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                {passwordsMatch ? "✓" : "○"}
              </span>
              <span>Passwords match</span>
            </div>
          </div>

          <div className="mt-2">
            <button
              type="submit"
              disabled={pending || !hasMinLength || !hasUppercase || !hasNumber || !passwordsMatch}
              className="rounded-full bg-[#F8D88E] hover:bg-[#F4CF74] px-6 py-2.5 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50"
            >
              {pending ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Security Policies Sidebar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col gap-4 text-xs">
        <h3 className="text-sm font-semibold text-zinc-900 ">
          Environment & Security Parameters
        </h3>

        <div className="flex flex-col gap-2 text-zinc-600 leading-relaxed">
          <div>
            <strong className="text-zinc-800 ">Access Token TTL:</strong> 900 seconds (15 min)
          </div>
          <div>
            <strong className="text-zinc-800 ">Refresh Token TTL:</strong> 30 days (auto-rotated)
          </div>
          <div>
            <strong className="text-zinc-800 ">Rate Limiter Window:</strong> 15 minutes
          </div>
          <div>
            <strong className="text-zinc-800 ">Max Login Failures:</strong> 10 attempts
          </div>
          <div>
            <strong className="text-zinc-800 ">OTP Code Lifespan:</strong> 5 minutes (capped to 5 attempts)
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-100 text-zinc-500">
          Security configurations are dynamically managed via environment variables and applied with strict server-side validation.
        </div>
      </div>
    </div>
  );
}
