import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAvailableClient } from "./not-available/not-available-client";

export const metadata: Metadata = {
  title: "Currently this page is not available — Homyz",
  description: "This page is currently not available or could not be found.",
};

export default function NotFound() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <NotAvailableClient />
    </Suspense>
  );
}
