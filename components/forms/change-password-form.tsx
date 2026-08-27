"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";

import { changePasswordAction } from "@/actions/user/changePassword";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [msg, setMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      currentPassword: String(fd.get("currentPassword") ?? ""),
      newPassword: String(fd.get("newPassword") ?? ""),
    };

    startTransition(async () => {
      const res = await changePasswordAction(input);
      if (!res.ok) {
        setMsg({ tone: "error", text: res.error });
        return;
      }
      setMsg({ tone: "success", text: "Password changed." });
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className={labelClass}>
          Current password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputClass} pr-10`}
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
        <label htmlFor="newPassword" className={labelClass}>
          New password
        </label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            className={`${inputClass} pr-10`}
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
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
