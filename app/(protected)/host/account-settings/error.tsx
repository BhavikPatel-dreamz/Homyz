"use client";

import React, { useEffect } from "react";
import { Container } from "@/components/ui/container";
import { SettingsErrorState } from "@/components/host/account-settings";

export default function AccountSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Host Account Settings Error:", error);
  }, [error]);

  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-10 sm:py-16">
      <SettingsErrorState
        title="Unable to load host settings"
        message={error.message || "An unexpected error occurred while loading host account settings."}
        onRetry={reset}
        backHref="/host/today"
      />
    </Container>
  );
}

