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
    <div className="flex flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
          Invite &amp; Earn
        </h2>
        <p className="mt-1 text-sm leading-5 text-[#727272] sm:text-base sm:leading-6">
          Share your love for Homyz. Friends get $25 off their first stay, and you get $25 credit when they complete their trip.
        </p>
      </div>

      {/* Shareable Link Hero Card */}
      <div className="relative mb-8 rounded-3xl border border-[#E5E5E5] bg-gradient-to-br from-[#FFF8E8] via-white to-[#FDF4D8] p-6 shadow-xs sm:p-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
          Your Exclusive Invite Link
        </span>
        <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-3">
          <div className="flex flex-1 items-center justify-between rounded-2xl border border-[#D7D7D7] bg-white px-4 py-3 text-sm text-[#1F1F1F]">
            <span className="truncate font-mono text-xs sm:text-sm text-[#1F1F1F] select-all">
              {referralLink}
            </span>
            <span className="ml-2 shrink-0 rounded-md bg-[#FFF8E8] px-2 py-0.5 font-mono text-[11px] font-bold text-[#1F1F1F]">
              {referralCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-full bg-[#FCDF9C] px-7 py-3 text-sm font-semibold text-[#1F1F1F] transition-all hover:bg-[#F7D37D] shrink-0 active:scale-98"
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
          <span className="text-xs text-[#727272] mr-2">Quick share:</span>
          <button
            type="button"
            onClick={() => shareVia("whatsapp")}
            className="rounded-full border border-[#D7D7D7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] hover:bg-zinc-50 transition-colors"
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => shareVia("twitter")}
            className="rounded-full border border-[#D7D7D7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] hover:bg-zinc-50 transition-colors"
          >
            X / Twitter
          </button>
          <button
            type="button"
            onClick={() => shareVia("email")}
            className="rounded-full border border-[#D7D7D7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] hover:bg-zinc-50 transition-colors"
          >
            Email
          </button>
        </div>
      </div>

      {/* Referral Stats 4-Column Grid */}
      <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <span className="text-xs text-[#727272]">Invited Friends</span>
          <span className="mt-1 text-2xl font-bold text-[#1F1F1F]">4</span>
          <span className="mt-1 text-[11px] text-[#727272]">Signed up with link</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <span className="text-xs text-[#727272]">Completed Stays</span>
          <span className="mt-1 text-2xl font-bold text-[#1F1F1F]">2</span>
          <span className="mt-1 text-[11px] text-[#727272]">Finished trips</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <span className="text-xs text-[#727272]">Total Credits Earned</span>
          <span className="mt-1 text-2xl font-bold text-emerald-700">$50.00</span>
          <span className="mt-1 text-[11px] text-[#727272]">Ready to use</span>
        </div>
        <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <span className="text-xs text-[#727272]">Pending Credits</span>
          <span className="mt-1 text-2xl font-bold text-[#1F1F1F]">$25.00</span>
          <span className="mt-1 text-[11px] text-[#727272]">Awaiting check-out</span>
        </div>
      </div>

      {/* 3-Step Guide */}
      <div className="mb-10">
        <h3 className="mb-4 text-lg font-semibold text-[#1F1F1F] sm:text-xl">
          How It Works
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCDF9C] text-sm font-bold text-[#1F1F1F]">
              1
            </span>
            <h4 className="mt-3 text-sm font-bold text-[#1F1F1F]">Send Invites</h4>
            <p className="mt-1 text-xs text-[#727272] leading-relaxed">
              Share your personal link via WhatsApp, email, or social media.
            </p>
          </div>
          <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCDF9C] text-sm font-bold text-[#1F1F1F]">
              2
            </span>
            <h4 className="mt-3 text-sm font-bold text-[#1F1F1F]">Friend Books</h4>
            <p className="mt-1 text-xs text-[#727272] leading-relaxed">
              They immediately receive $25 off their first eligible booking of $100+.
            </p>
          </div>
          <div className="flex flex-col rounded-2xl border border-[#E5E5E5] bg-white p-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCDF9C] text-sm font-bold text-[#1F1F1F]">
              3
            </span>
            <h4 className="mt-3 text-sm font-bold text-[#1F1F1F]">Get $25 Reward</h4>
            <p className="mt-1 text-xs text-[#727272] leading-relaxed">
              You receive $25 in your Homyz travel credit wallet as soon as they complete their trip.
            </p>
          </div>
        </div>
      </div>

      {/* Referrals Activity List */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-[#1F1F1F] sm:text-xl">
          Referral Activity
        </h3>
        <div className="divide-y divide-[#E5E5E5] rounded-2xl border border-[#E5E5E5] bg-white">
          <div className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#1F1F1F]">Sarah Miller</span>
              <span className="text-xs text-[#727272]">Stay completed at Malibu Beach Villa • Aug 14, 2026</span>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              +$25.00 Earned
            </span>
          </div>
          <div className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#1F1F1F]">David Kim</span>
              <span className="text-xs text-[#727272]">Stay completed at Alpine Loft • Jul 28, 2026</span>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              +$25.00 Earned
            </span>
          </div>
          <div className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#1F1F1F]">Elena Rostova</span>
              <span className="text-xs text-[#727272]">Account created • Booking pending • Sep 01, 2026</span>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              Pending $25.00
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
