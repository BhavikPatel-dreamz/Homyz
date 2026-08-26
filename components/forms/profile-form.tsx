"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { updateProfileAction } from "@/actions/user/updateProfile";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function ProfileForm({
  initial,
}: {
  initial: { name: string | null; phone: string | null; image: string | null };
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    // Only send fields the user actually filled in.
    const input: Record<string, string> = {};
    for (const key of ["name", "phone", "image"] as const) {
      const value = String(fd.get(key) ?? "").trim();
      if (value) input[key] = value;
    }

    startTransition(async () => {
      const res = await updateProfileAction(input);
      if (!res.ok) {
        setMsg({ tone: "error", text: res.error });
        return;
      }
      setMsg({ tone: "success", text: "Profile updated." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initial.name ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className={labelClass}>
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={initial.phone ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="image" className={labelClass}>
          Avatar URL
        </label>
        <input
          id="image"
          name="image"
          type="url"
          defaultValue={initial.image ?? ""}
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
