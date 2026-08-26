"use client";

import { signIn } from "next-auth/react";

import { secondaryButtonClass } from "../ui";

export type OAuthProviders = {
  google?: boolean;
  facebook?: boolean;
  apple?: boolean;
};

// Renders a button per configured OAuth provider. When none are configured
// (no env keys), renders nothing.
export function OAuthButtons({
  providers,
  callbackUrl,
}: {
  providers: OAuthProviders;
  callbackUrl: string;
}) {
  const entries: Array<[keyof OAuthProviders, string]> = [
    ["google", "Continue with Google"],
    ["facebook", "Continue with Facebook"],
    ["apple", "Continue with Apple"],
  ];
  const available = entries.filter(([key]) => providers[key]);
  if (available.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {available.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={secondaryButtonClass}
          onClick={() => signIn(key, { callbackUrl })}
        >
          {label}
        </button>
      ))}
      <div className="my-2 flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
