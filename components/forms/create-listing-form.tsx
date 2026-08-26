"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { createListingAction } from "@/actions/host/listings";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function CreateListingForm() {
  const router = useRouter();
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
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      price: Number(fd.get("price") ?? 0),
      published: fd.get("published") === "on",
    };

    startTransition(async () => {
      const res = await createListingAction(input);
      if (!res.ok) {
        setMsg({ tone: "error", text: res.error });
        return;
      }
      setMsg({ tone: "success", text: "Listing created." });
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={labelClass}>
          Title
        </label>
        <input id="title" name="title" type="text" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="price" className={labelClass}>
          Price per night (in cents)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          min={1}
          required
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input name="published" type="checkbox" className="h-4 w-4" />
        Publish immediately
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating…" : "Create listing"}
      </button>
    </form>
  );
}
