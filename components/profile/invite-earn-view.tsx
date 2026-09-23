"use client";

import React, { useState } from "react";

export function InviteEarnView({ user }: { user?: { name?: string | null; id?: string } }) {
  const [copied, setCopied] = useState(false);

  const referralCode = user?.name
    ? `HOMIE-${user.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}-26`
    : "HOMIE-GUEST-26";
  const referralLink = `https://homyz.app/invite/${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const shareVia = (platform: "whatsapp" | "twitter" | "email") => {
    const text = `Join Homyz and get $25 off your first luxury stay! Use my invite link: ${referralLink}`;
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } else if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    } else if (platform === "email") {
      window.open(`mailto:?subject=Join Homyz and get $25 off&body=${encodeURIComponent(text)}`, "_blank");
    }
  };

  return (
    <div className="flex w-full max-w-[1080px] flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-7 lg:mb-9">
        <h2 className="text-[26px] font-semibold leading-8 tracking-[-0.03em] text-[#1F1F1F] sm:text-[30px] sm:leading-9 lg:text-[34px] lg:leading-10">
          Invite &amp; Earn
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#727272] sm:text-base">
          Share your love for Homyz. Friends get $25 off their first stay, and you get $25 credit when they complete their trip.
        </p>
      </div>

      {/* Shareable Link Hero Card */}
      <div className="relative mb-8 rounded-lg border border-[#E5E5E5] bg-gradient-to-br from-[#FFF8E8] via-white to-[#FDF4D8] p-5 shadow-sm sm:p-7">
        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#727272]">
          Your Exclusive Invite Link
        </span>
        <div className="mt-3 flex flex-col items-stretch gap-3 lg:flex-row">
          <div className="flex min-h-12 flex-1 items-center justify-between rounded-xl border border-[#D7D7D7] bg-white px-3.5 py-2.5 text-sm text-[#1F1F1F] shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-4">
            <span className="min-w-0 truncate font-mono text-xs text-[#1F1F1F] select-all sm:text-sm">
              {referralLink}
            </span>
            <span className="ml-3 shrink-0 rounded-md bg-[#FFF8E8] px-2 py-1 font-mono text-[10px] font-semibold tracking-wide text-[#1F1F1F] sm:text-[11px]">
              {referralCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#FCDF9C] px-6 text-sm font-semibold text-[#1F1F1F] transition-all hover:bg-[#F7D37D] active:scale-98 lg:px-7"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-[#1F1F1F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Share buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-[#727272]">Quick share:</span>
          <button
            type="button"
            onClick={() => shareVia("whatsapp")}
            className="min-h-8 rounded-full border border-[#D7D7D7] bg-white px-3.5 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50"
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => shareVia("twitter")}
            className="min-h-8 rounded-full border border-[#D7D7D7] bg-white px-3.5 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50"
          >
            X / Twitter
          </button>
          <button
            type="button"
            onClick={() => shareVia("email")}
            className="min-h-8 rounded-full border border-[#D7D7D7] bg-white px-3.5 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50"
          >
            Email
          </button>
        </div>
      </div>

      {/* Referral Stats 4-Column Grid */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="flex min-h-32 flex-col rounded-lg border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5">
          <span className="text-xs font-medium text-[#727272]">Invited Friends</span>
          <span className="mt-2 text-2xl font-semibold leading-7 tracking-[-0.02em] text-[#1F1F1F]">4</span>
          <span className="mt-auto pt-2 text-sm leading-4 text-[#727272]">Signed up with link</span>
        </div>
        <div className="flex min-h-32 flex-col rounded-lg border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5">
          <span className="text-xs font-medium text-[#727272]">Completed Stays</span>
          <span className="mt-2 text-2xl font-semibold leading-7 tracking-[-0.02em] text-[#1F1F1F]">2</span>
          <span className="mt-auto pt-2 text-sm leading-4 text-[#727272]">Finished trips</span>
        </div>
        <div className="flex min-h-32 flex-col rounded-lg border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5">
          <span className="text-xs font-medium text-[#727272]">Total Credits Earned</span>
          <span className="mt-2 text-2xl font-semibold leading-7 tracking-[-0.02em] text-emerald-700">$50.00</span>
          <span className="mt-auto pt-2 text-sm leading-4 text-[#727272]">Ready to use</span>
        </div>
        <div className="flex min-h-32 flex-col rounded-lg border border-[#E5E5E5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5">
          <span className="text-xs font-medium text-[#727272]">Pending Credits</span>
          <span className="mt-2 text-2xl font-semibold leading-7 tracking-[-0.02em] text-[#1F1F1F]">$25.00</span>
          <span className="mt-auto pt-2 text-sm leading-4 text-[#727272]">Awaiting check-out</span>
        </div>
      </div>

      {/* 3-Step Guide */}
      <div className="mb-10">
        <h3 className="mb-4 text-xl font-semibold tracking-[-0.02em] text-[#1F1F1F]">
          How It Works
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex min-h-44 flex-col rounded-lg border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#FCDF9C] text-sm font-semibold text-[#1F1F1F]">
              1
            </span>
            <h4 className="mt-4 text-sm font-semibold text-[#1F1F1F]">Send Invites</h4>
            <p className="mt-1.5 text-sm leading-5 text-[#727272]">
              Share your personal link via WhatsApp, email, or social media.
            </p>
          </div>
          <div className="flex min-h-44 flex-col rounded-lg border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#FCDF9C] text-sm font-semibold text-[#1F1F1F]">
              2
            </span>
            <h4 className="mt-4 text-sm font-semibold text-[#1F1F1F]">Friend Books</h4>
            <p className="mt-1.5 text-sm leading-5 text-[#727272]">
              They immediately receive $25 off their first eligible booking of $100+.
            </p>
          </div>
          <div className="flex min-h-44 flex-col rounded-lg border border-[#E5E5E5] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#FCDF9C] text-sm font-semibold text-[#1F1F1F]">
              3
            </span>
            <h4 className="mt-4 text-sm font-semibold text-[#1F1F1F]">Get $25 Reward</h4>
            <p className="mt-1.5 text-sm leading-5 text-[#727272]">
              You receive $25 in your Homyz travel credit wallet as soon as they complete their trip.
            </p>
          </div>
        </div>
      </div>

      {/* Referrals Activity List */}
      <div>
        <h3 className="mb-4 text-xl font-semibold tracking-[-0.02em] text-[#1F1F1F]">
          Referral Activity
        </h3>
        <div className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-zinc-50 sm:px-5">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#1F1F1F]">Sarah Miller</span>
              <span className="mt-0.5 text-sm leading-5 text-[#727272]">Stay completed at Malibu Beach Villa • Aug 14, 2026</span>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 text-center">
              +$25.00 Earned
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-zinc-50 sm:px-5">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#1F1F1F]">David Kim</span>
              <span className="mt-0.5 text-sm leading-5 text-[#727272]">Stay completed at Alpine Loft • Jul 28, 2026</span>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 text-center">
              +$25.00 Earned
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-zinc-50 sm:px-5">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#1F1F1F]">Elena Rostova</span>
              <span className="mt-0.5 text-sm leading-5 text-[#727272]">Account created • Booking pending • Sep 01, 2026</span>
            </div>
            <span className="rounded-full bg-[#faeebc] px-3 py-1 text-xs font-semibold text-amber-800 text-center">
              Pending $25.00
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
