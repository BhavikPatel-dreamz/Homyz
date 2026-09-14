"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import { toast } from "@/components/ui/toast";
import { changePasswordAction } from "@/actions/user/changePassword";
import { updateHostServiceFeeAction } from "@/actions/admin/settingsActions";

interface AdminSettingsFormProps {
  initialHostServiceFee?: number;
}

export function AdminSettingsForm({ initialHostServiceFee = 15 }: AdminSettingsFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Host Service Fee states
  const [hostServiceFee, setHostServiceFee] = useState<number>(initialHostServiceFee);
  const [savedFee, setSavedFee] = useState<number>(initialHostServiceFee);
  const [isFeeSaving, startFeeTransition] = useTransition();

  const [pending, startTransition] = useTransition();

  function handleSaveFee(e: React.FormEvent) {
    e.preventDefault();
    if (isNaN(hostServiceFee) || hostServiceFee < 0 || hostServiceFee > 100) {
      toast.error("Guest service fee must be between 0% and 100%.");
      return;
    }

    startFeeTransition(async () => {
      const res = await updateHostServiceFeeAction({ percentage: hostServiceFee });
      if (!res.ok) {
        toast.error(res.error || "Failed to update guest service fee.");
        return;
      }
      setSavedFee(hostServiceFee);
      toast.success(`Guest service fee updated to ${hostServiceFee}% successfully!`);
    });
  }

  // Password rules checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!hasMinLength || !hasUppercase || !hasNumber) {
      toast.error("New password does not meet complexity requirements.");
      return;
    }

    if (!passwordsMatch) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Your password has been changed successfully!");
    });
  }

  return (
    <div className="flex flex-col gap-8 font-sans text-muted-foreground">
      {/* Platform Pricing & Fee Configuration Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-muted-foreground">Global Guest Service Fee</h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                Active Fee: {savedFee}%
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] max-w-2xl">
              Configure the platform service fee percentage deducted from hosts on each booking. This fee applies directly to accommodation stay amounts.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveFee} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="host-service-fee-input" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Fee Percentage (%)</span>
                <span className="text-xs font-bold text-amber-500">{hostServiceFee}%</span>
              </label>

              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    id="host-service-fee-input"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={hostServiceFee}
                    onChange={(e) => setHostServiceFee(Number(e.target.value))}
                    required
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-sm font-bold text-muted-foreground outline-none focus:border-[var(--accent)] transition-all font-mono"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 pointer-events-none">
                    %
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 10, 12, 15, 18, 20].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHostServiceFee(preset)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        hostServiceFee === preset
                          ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                          : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground border border-[var(--border-subtle)]"
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider Control */}
              <div className="mt-2">
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={0.5}
                  value={Math.min(50, hostServiceFee)}
                  onChange={(e) => setHostServiceFee(Number(e.target.value))}
                  aria-label="Guest service fee slider"
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] mt-1">
                  <span>0%</span>
                  <span>10%</span>
                  <span>15% (Default)</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            {/* Non-Taxable Protection Guarantee Alert */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-600">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Tax Protection Guaranteed</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                The Guest Service Fee is strictly excluded from the taxable base. Tax rules apply only to the stay amount and eligible cleaning fees, never on top of the Guest Service Fee.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={isFeeSaving || hostServiceFee === savedFee}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-6 py-2.5 text-xs font-semibold text-[var(--accent-foreground)] transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
              >
                {isFeeSaving && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{isFeeSaving ? "Saving..." : hostServiceFee === savedFee ? "Saved" : "Save Guest Service Fee"}</span>
              </button>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 flex flex-col justify-between text-xs">
            <div>
              <span className="font-bold text-muted-foreground block mb-2">Live Calculation Simulation</span>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-4">
                Example booking with a stay amount of 1,000.00 SAR:
              </p>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                  <dt className="text-[var(--muted-foreground)]">Stay Amount (Accommodation)</dt>
                  <dd className="font-mono font-medium text-foreground">1,000.00 SAR</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                  <dt className="text-[var(--muted-foreground)]">Guest Service Fee ({hostServiceFee}%)</dt>
                  <dd className="font-mono font-bold text-rose-500">
                    - {(1000 * (hostServiceFee / 100)).toFixed(2)} SAR
                  </dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                  <dt className="text-[var(--muted-foreground)]">Host Net Payout</dt>
                  <dd className="font-mono font-bold text-emerald-600">
                    {(1000 - 1000 * (hostServiceFee / 100)).toFixed(2)} SAR
                  </dd>
                </div>
                <div className="flex justify-between py-1 text-[11px] text-[var(--muted-foreground)]">
                  <dt>VAT (15% on 1,000 SAR Stay)</dt>
                  <dd className="font-mono">150.00 SAR</dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-[10px] text-[var(--muted-foreground)]">
              Formula: Host Payout = Stay Amount + Cleaning Fee - Guest Service Fee
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Change Password Card */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <h2 className="text-base font-semibold text-muted-foreground mb-1">
          Change Administrator Password
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mb-6">
          Update your administrative password. Changing your password invalidates all other active sessions.
        </p>

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-lg">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Current Password *
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-xs text-muted-foreground outline-none focus:border-[var(--accent)] transition-all"
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
            <label className="text-xs font-semibold text-muted-foreground">
              New Password *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-xs text-muted-foreground outline-none focus:border-[var(--accent)] transition-all"
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
            <label className="text-xs font-semibold text-muted-foreground">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 pr-10 text-xs text-muted-foreground outline-none focus:border-[var(--accent)] transition-all"
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
            <div className="font-semibold text-muted-foreground mb-0.5">
              Password Requirements:
            </div>
            <div className="flex items-center gap-2">
              <span className={hasMinLength ? "text-emerald-600 font-semibold" : "text-[var(--muted-foreground)] opacity-40"}>
                {hasMinLength ? "✓" : "○"}
              </span>
              <span>Minimum 8 characters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasUppercase ? "text-emerald-600 font-semibold" : "text-[var(--muted-foreground)] opacity-40"}>
                {hasUppercase ? "✓" : "○"}
              </span>
              <span>At least one uppercase letter (A-Z)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={hasNumber ? "text-emerald-600 font-semibold" : "text-[var(--muted-foreground)] opacity-40"}>
                {hasNumber ? "✓" : "○"}
              </span>
              <span>At least one number (0-9)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={passwordsMatch ? "text-emerald-600 font-semibold" : "text-[var(--muted-foreground)] opacity-40"}>
                {passwordsMatch ? "✓" : "○"}
              </span>
              <span>Passwords match</span>
            </div>
          </div>

          <div className="mt-2">
            <button
              type="submit"
              disabled={pending || !hasMinLength || !hasUppercase || !hasNumber || !passwordsMatch}
              className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-6 py-2.5 text-xs font-semibold text-[var(--accent-foreground)] transition-all shadow-2xs disabled:opacity-50 inline-flex items-center gap-2"
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
        <h3 className="text-sm font-semibold text-muted-foreground">
          Environment & Security Parameters
        </h3>

        <div className="flex flex-col gap-2.5 text-[var(--muted-foreground)] leading-relaxed">
          <div>
            <strong className="text-muted-foreground font-semibold">Access Token TTL:</strong> 900 seconds (15 min)
          </div>
          <div>
            <strong className="text-muted-foreground font-semibold">Refresh Token TTL:</strong> 30 days (auto-rotated)
          </div>
          <div>
            <strong className="text-muted-foreground font-semibold">Rate Limiter Window:</strong> 15 minutes
          </div>
          <div>
            <strong className="text-muted-foreground font-semibold">Max Login Failures:</strong> 10 attempts
          </div>
          <div>
            <strong className="text-muted-foreground font-semibold">OTP Code Lifespan:</strong> 5 minutes (capped to 5 attempts)
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[var(--muted-foreground)] text-[11px]">
          Security configurations are dynamically managed via environment variables and applied with strict server-side validation.
        </div>
      </div>
    </div>
  </div>
  );
}
