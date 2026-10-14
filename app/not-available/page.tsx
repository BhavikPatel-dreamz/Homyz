import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAvailableClient } from "./not-available-client";

export const metadata: Metadata = {
  title: "Currently this page is not available — Homyz",
  description: "This page is currently under development and will be available soon.",
};

export default function NotAvailablePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <NotAvailableClient />
    </Suspense>
  );
}
