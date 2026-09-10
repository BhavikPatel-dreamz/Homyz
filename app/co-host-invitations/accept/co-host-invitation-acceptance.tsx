"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { acceptListingCoHostAction } from "@/actions/host/cohosts";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";

type ResultState =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4.25 4.25L19 6.5" />
    </svg>
  );
}

function CoHostIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none" className="size-7 text-[#1F1F1F] sm:size-8">
      <circle cx="17" cy="16" r="6.5" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="33" cy="18" r="5.5" stroke="currentColor" strokeWidth="2.5" />
      <path d="M5.5 37.5c1.5-7 6-10.5 11.5-10.5s10 3.5 11.5 10.5M27 36.5c1.1-4.9 4.2-7.5 8.5-7.5 3.1 0 5.6 1.4 7 4.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function CoHostInvitationAcceptance({ token }: { token: string }) {
  const { data: session, status } = useSession();
  const [result, setResult] = useState<ResultState>(null);
  const [pending, setPending] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const callbackUrl = `/co-host-invitations/accept?token=${encodeURIComponent(token)}`;
  const signInHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const signUpHref = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const isSignedIn = Boolean(session?.user);

  async function accept() {
    if (!token || pending) return;
    setPending(true);
    setResult(null);
    const response = await acceptListingCoHostAction(token);
    setPending(false);
    setResult(
      response.ok
        ? { tone: "success", message: "You are now a co-host for this listing." }
        : { tone: "error", message: response.error },
    );
  }

  async function switchAccount() {
    setSwitchingAccount(true);
    await signOut({ callbackUrl: signInHref });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F5] text-[#1F1F1F]">
      <AppHeader showBottomBorder />

      <main className="flex flex-1 items-center px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-20">
        <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_18px_60px_rgba(31,31,31,0.09)] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative overflow-hidden bg-[#FCDF9C] px-7 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <div className="absolute -left-14 -top-16 size-52 rounded-full bg-white/35" />
            <div className="absolute -bottom-24 -right-20 size-64 rounded-full border-[28px] border-[#E9C979]/60" />
            <div className="relative flex h-full flex-col">
              <div className="flex size-13 items-center justify-center rounded-2xl bg-white shadow-sm sm:size-15">
                <CoHostIcon />
              </div>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-[#63501C]">You&apos;re invited</p>
              <h1 className="mt-3 max-w-sm text-[31px] font-semibold leading-[1.14] tracking-[-0.04em] sm:text-[39px]">
                Help host a place guests love.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-[#4D4328] sm:text-[15px]">
                Co-hosting lets you work alongside the listing owner to help create a welcoming stay for every guest.
              </p>

              <div className="mt-9 space-y-4 border-t border-[#B69243]/35 pt-6 sm:mt-auto sm:pt-7">
                {[
                  "Work together on one listing",
                  "Keep your account and information secure",
                  "Accept only if this invitation is for you",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-medium">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/70">
                      <CheckIcon className="size-3.5" />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex items-center px-7 py-9 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <div className="w-full max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#717171]">Homyz co-hosting</p>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">
                Accept your invitation
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#717171]">
                Sign in with the email address or phone number that received this invitation, then confirm that you&apos;d like to join this listing.
              </p>

              {!token ? (
                <div role="alert" className="mt-7 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
                  This invitation link is incomplete. Ask the listing owner to send a new invite.
                </div>
              ) : result?.tone === "success" ? (
                <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <span className="grid size-9 place-items-center rounded-full bg-emerald-600 text-white">
                    <CheckIcon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">Invitation accepted</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">{result.message}</p>
                  <Link href="/dashboard" className="mt-5 inline-flex rounded-full bg-[#1F1F1F] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#3f3f3f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
                    Go to dashboard
                  </Link>
                </div>
              ) : (
                <>
                  <ol className="mt-7 space-y-3" aria-label="How to accept your invitation">
                    <li className="flex gap-3 rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-4">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-xs font-semibold text-white">1</span>
                      <div>
                        <p className="text-sm font-semibold">Sign in to your Homyz account</p>
                        <p className="mt-0.5 text-xs leading-5 text-[#717171]">Use the same email address or phone number that received the invite.</p>
                      </div>
                    </li>
                    <li className="flex gap-3 rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-4">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#1F1F1F] text-xs font-semibold text-white">2</span>
                      <div>
                        <p className="text-sm font-semibold">Accept this co-host invitation</p>
                        <p className="mt-0.5 text-xs leading-5 text-[#717171]">We&apos;ll securely add you to the listing once your contact details match.</p>
                      </div>
                    </li>
                  </ol>

                  {result?.tone === "error" && (
                    <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-5 text-rose-800">
                      <p>{result.message}</p>
                      {isSignedIn && (
                        <>
                          <p className="mt-2 text-xs leading-5 text-rose-700">
                            You&apos;re currently signed in as {session?.user?.email || "another Homyz account"}. Sign out, then sign in or create an account with the invited contact details.
                          </p>
                          <button
                            type="button"
                            onClick={switchAccount}
                            disabled={switchingAccount}
                            className="mt-3 inline-flex rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-wait disabled:opacity-60"
                          >
                            {switchingAccount ? "Signing out…" : "Switch account"}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-7">
                    {status === "loading" ? (
                      <div className="h-12 w-44 animate-pulse rounded-full bg-zinc-200" aria-label="Checking sign-in status" />
                    ) : isSignedIn ? (
                      <button
                        type="button"
                        onClick={accept}
                        disabled={pending}
                        className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FCDF9C] px-6 text-sm font-semibold text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-wait disabled:opacity-60"
                      >
                        {pending ? "Accepting invitation…" : "Accept invitation"}
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={signInHref} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#FCDF9C] px-6 text-sm font-semibold text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
                          Sign in to accept
                        </Link>
                        <Link href={signUpHref} className="px-2 text-sm font-medium underline underline-offset-4 transition-colors hover:text-[#717171]">
                          Create an account
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}

              <p className="mt-7 text-xs leading-5 text-[#717171]">
                Not expecting this invitation? You can safely close this page. Need help? <Link href="/help" className="font-medium text-[#1F1F1F] underline underline-offset-3">Visit Help Center</Link>.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
