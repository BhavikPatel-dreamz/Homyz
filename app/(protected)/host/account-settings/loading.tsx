import React from "react";
import { Container } from "@/components/ui/container";
import { SettingsLoadingSkeleton } from "@/components/host/account-settings";

export default function AccountSettingsLoading() {
  return (
    <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <SettingsLoadingSkeleton cardsCount={6} />
    </Container>
  );
}

