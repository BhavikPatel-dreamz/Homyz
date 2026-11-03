"use client";

import { SupportResolutionCenter } from "@/components/profile/support-resolution-center";

/**
 * Compatibility export for the existing profile tab. The prior implementation
 * was a simulated local chat; this now renders persisted support cases.
 */
export function SupportChatView({ user: _user }: { user?: { name?: string | null } }) {
  void _user;
  return <SupportResolutionCenter />;
}
