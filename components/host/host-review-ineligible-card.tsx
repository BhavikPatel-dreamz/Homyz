"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";

interface HostReviewIneligibleCardProps {
  status: string;
  reason?: string | null;
  returnHref: string;
}

export function HostReviewIneligibleCard({
  status,
  reason,
  returnHref,
}: HostReviewIneligibleCardProps) {
  const { t } = useLanguage();

  const title =
    status === "REVIEW_SUBMITTED"
      ? t("host_review_submitted_title", "Review submitted")
      : status === "REVIEW_WINDOW_EXPIRED"
        ? t("host_review_window_expired", "Review window expired")
        : t("host_review_unavailable", "Review unavailable");

  return (
    <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-800">
        !
      </span>
      <h1 className="mt-4">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        {reason || t("host_review_unavailable", "This reservation is not eligible for a host review.")}
      </p>
      <Link
        href={returnHref}
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#1F1F1F] px-6 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
      >
        {t("host_review_back_to_reservations", "Back to reservations")}
      </Link>
    </section>
  );
}
