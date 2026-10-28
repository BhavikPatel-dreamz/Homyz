"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { TravelProfileVisibility } from "@/types/travel";

interface TravelProfileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  visibility?: TravelProfileVisibility;
}

export function TravelProfileShareModal({
  isOpen,
  onClose,
  displayName,
  handle,
  avatarUrl,
  visibility = TravelProfileVisibility.PUBLIC,
}: TravelProfileShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Compute canonical URL in browser
  const canonicalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/travelers/${encodeURIComponent(handle)}`
      : `https://homyz.co/travelers/${encodeURIComponent(handle)}`;

  useEffect(() => {
    if (!isOpen) return;
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonicalUrl);
      } else {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = canonicalUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };

  const handleNativeShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({
          title: `${displayName}'s Travel Profile — Homyz`,
          text: `Check out ${displayName}'s travel memories, verified destinations, and travel stamps on Homyz!`,
          url: canonicalUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  const shareText = encodeURIComponent(`Check out ${displayName}'s travel profile on Homyz!`);
  const encodedUrl = encodeURIComponent(canonicalUrl);

  const socialLinks = [
    {
      name: "X (Twitter)",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`,
    },
    {
      name: "WhatsApp",
      icon: "💬",
      url: `https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`,
    },
    {
      name: "Facebook",
      icon: "📘",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "LinkedIn",
      icon: "💼",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
  ];

  const isRestricted = visibility !== TravelProfileVisibility.PUBLIC;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-100 flex flex-col items-center animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close share modal"
          className="absolute top-4 right-4 size-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition cursor-pointer"
        >
          ✕
        </button>

        {/* Traveler Header */}
        <div className="relative size-20 rounded-full overflow-hidden bg-zinc-200 border-2 border-white shadow-md mb-3">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-amber-100 text-amber-700 text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h3 id="share-modal-title" className="text-lg font-bold text-zinc-900 text-center">
          Share {displayName}&apos;s Profile
        </h3>
        <p className="text-xs text-zinc-500 text-center mt-0.5">
          @{handle}
        </p>

        {/* Privacy Warning if Private or Followers Only */}
        {isRestricted && (
          <div className="w-full mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left flex items-start gap-3">
            <span className="text-base leading-none">⚠️</span>
            <div className="text-xs text-amber-800">
              <strong className="block font-semibold">
                {visibility === TravelProfileVisibility.PRIVATE ? "Profile is Private" : "Followers Only"}
              </strong>
              <span>
                {visibility === TravelProfileVisibility.PRIVATE
                  ? "Only you can view this profile. Sharing this link will not grant access to unauthorized visitors."
                  : "Only approved followers can view your travel content. Other visitors will see a restricted profile."}
              </span>
            </div>
          </div>
        )}

        {/* Copyable Link Input */}
        <div className="w-full mt-5">
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
            Profile Link
          </label>
          <div className="flex items-center gap-2 p-1.5 rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-zinc-400 transition">
            <input
              type="text"
              readOnly
              value={canonicalUrl}
              className="w-full bg-transparent px-2 text-xs font-mono text-zinc-700 outline-none select-all truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-900 hover:bg-black text-white shadow-2xs"
              }`}
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

        {/* Native Device Share Action */}
        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full mt-3 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <span>📱</span>
            <span>Share via Device</span>
          </button>
        )}

        {/* Social Share Grid */}
        <div className="w-full mt-5 pt-4 border-t border-zinc-100">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center mb-3">
            Share to Socials
          </p>
          <div className="grid grid-cols-4 gap-2">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-2.5 rounded-2xl border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50 transition text-zinc-700"
              >
                <span className="text-lg mb-1">{social.icon}</span>
                <span className="text-[10px] font-medium truncate max-w-[60px]">
                  {social.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

