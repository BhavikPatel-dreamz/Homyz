"use client";

import Link from "next/link";
import { useState } from "react";
import { acceptListingCoHostAction } from "@/actions/host/cohosts";

export function CoHostInvitationAcceptance({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    const result = await acceptListingCoHostAction(token);
    setPending(false);
    setMessage(result.ok ? "You are now a co-host for this listing." : result.error);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
      <section className="w-full rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Co-host invitation</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Sign in with the invited email address, then accept to join this listing as a co-host.</p>
        {!token ? <p className="mt-5 text-sm text-rose-700">This invitation link is incomplete.</p> : (
          <button type="button" disabled={pending} onClick={accept} className="mt-6 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "Accepting…" : "Accept invitation"}
          </button>
        )}
        {message && <p className="mt-4 text-sm text-zinc-700">{message}</p>}
        <Link className="mt-5 inline-block text-sm font-medium underline" href={`/login?returnUrl=${encodeURIComponent(`/co-host-invitations/accept?token=${token}`)}`}>Sign in</Link>
      </section>
    </main>
  );
}
