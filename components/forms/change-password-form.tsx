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
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className={labelClass}>
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
