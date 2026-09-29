import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

type ReferralStatus = "JOINED" | "PENDING_APPROVAL" | "CREDITED" | "NOT_APPROVED";
type ReferralData = {
  referralUrl: string;
  rewardRule: { points: number; qualifyingCondition: "FIRST_COMPLETED_STAY" } | null;
  totals: { invited: number; pendingPoints: number; creditedPoints: number };
  activityTotal?: number;
  activity: Array<{ id: string; guestName: string; joinedAt: string; status: ReferralStatus; points: number | null; reviewedAt: string | null }>;
};
type CopyState = "idle" | "copied" | "error";

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable");
}

function InviteEarnSkeleton() {
  return <div aria-busy="true" aria-label="Loading invite and earn" className="w-full max-w-[1080px] animate-pulse space-y-6"><div className="h-10 w-52 rounded-lg bg-zinc-200" /><div className="h-36 rounded-2xl border border-[#E5E5E5] bg-zinc-50" /><div className="grid gap-4 sm:grid-cols-3"><div className="h-28 rounded-2xl bg-zinc-100" /><div className="h-28 rounded-2xl bg-zinc-100" /><div className="h-28 rounded-2xl bg-zinc-100" /></div><div className="h-56 rounded-2xl bg-zinc-100" /></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function InviteEarnView() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLanguage();

  const statusCopy: Record<ReferralStatus, string> = {
    JOINED: t("profile_invite_status_joined", "Joined — awaiting first completed stay"),
    PENDING_APPROVAL: t("profile_invite_status_pending", "Stay complete — credit awaiting approval"),
    CREDITED: t("profile_invite_status_credited", "Points credited"),
    NOT_APPROVED: t("profile_invite_status_not_approved", "Credit not approved"),
  };

  const loadReferral = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true); setError(null);
    try {
      const response = await fetch("/api/v1/referrals/me", { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.data?.referralUrl) throw new Error(payload?.error?.message || t("profile_invite_unable_to_load", "Unable to load your referral details."));
      setData(payload.data as ReferralData);
    } catch (requestError) {
      if ((requestError as { name?: string })?.name !== "AbortError") setError(requestError instanceof Error ? requestError.message : t("profile_invite_unable_to_load", "Unable to load your referral details."));
    } finally { if (!signal?.aborted) setIsLoading(false); }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReferral(controller.signal);
    return () => { controller.abort(); if (copyResetTimer.current) clearTimeout(copyResetTimer.current); };
  }, [loadReferral]);

  const showCopyState = (nextState: CopyState) => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    setCopyState(nextState);
    copyResetTimer.current = setTimeout(() => setCopyState("idle"), 2500);
  };
  const handleCopy = async () => { if (!data) return; try { await copyToClipboard(data.referralUrl); showCopyState("copied"); } catch { showCopyState("error"); } };
  const shareOnWhatsApp = () => {
    if (data) {
      const msg = t("profile_invite_whatsapp_message", { url: data.referralUrl }, `Join Homyz using my referral link: ${data.referralUrl}`);
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    }
  };

  if (isLoading) return <InviteEarnSkeleton />;
  if (error || !data) return <div className="w-full max-w-[1080px]"><h2 className="text-[28px] font-medium text-[#1F1F1F]">{t("profile_invite_title", "Invite & Earn")}</h2><div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><p>{error || t("profile_invite_unable_to_load", "Unable to load your referral details.")}</p><button type="button" onClick={() => void loadReferral()} className="mt-4 rounded-full border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-800">{t("profile_invite_try_again", "Try again")}</button></div></div>;

  const rewardCopy = data.rewardRule
    ? t("profile_invite_reward_rule_active", { points: data.rewardRule.points.toLocaleString() }, `Earn ${data.rewardRule.points.toLocaleString()} points when a friend completes their first stay. A Homyz administrator reviews the qualifying stay before points are credited.`)
    : t("profile_invite_reward_rule_inactive", "Referral rewards are not currently available. Your unique link is still ready to share.");
  return (
    <div className="flex w-full max-w-[1080px] flex-col animate-in fade-in duration-300">
      <div className="mb-7 lg:mb-9"><h2 className="text-[22px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] lg:text-[32px]">{t("profile_invite_title", "Invite & Earn")}</h2><p className="mt-1 text-sm leading-6 text-[#727272] sm:text-base">{t("profile_invite_subtitle", "Share your link, then follow every invitation and referral credit here.")}</p></div>
      <section aria-labelledby="referral-link-heading" className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6"><h3 id="referral-link-heading" className="text-base font-semibold text-[#1F1F1F]">{t("profile_invite_your_link", "Your referral link")}</h3><div className="mt-3 flex flex-col gap-3 sm:flex-row"><p className="flex min-h-12 min-w-0 flex-1 items-center rounded-xl border border-[#D7D7D7] bg-zinc-50 px-3.5 font-mono text-xs text-[#1F1F1F] sm:text-sm" title={data.referralUrl}><span className="truncate">{data.referralUrl}</span></p><button type="button" onClick={() => void handleCopy()} className="min-h-12 rounded-full bg-[#FCDF9C] px-6 text-sm font-semibold text-[#1F1F1F]">{copyState === "copied" ? t("profile_invite_copied", "Copied") : t("profile_invite_copy_link", "Copy link")}</button></div>{copyState === "error" ? <p role="status" className="mt-2 text-xs text-rose-700">{t("profile_invite_copy_error", "We couldn't copy the link. Please select and copy it manually.")}</p> : null}<div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-xs font-medium text-[#727272]">{t("profile_invite_share_with", "Share with:")}</span><button type="button" onClick={shareOnWhatsApp} className="min-h-10 rounded-full border border-[#D7D7D7] bg-white px-4 text-sm font-medium text-[#1F1F1F]">WhatsApp</button></div></section>
      <section aria-label="Referral totals" className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[#E5E5E5] bg-white p-5"><p className="text-sm text-[#727272]">{t("profile_invite_stat_invitations", "Invitations")}</p><p className="mt-2 text-2xl font-semibold text-[#1F1F1F]">{data.totals.invited}</p></div><div className="rounded-2xl border border-[#E5E5E5] bg-white p-5"><p className="text-sm text-[#727272]">{t("profile_invite_stat_pending_credits", "Pending credits")}</p><p className="mt-2 text-2xl font-semibold text-[#1F1F1F]">{data.totals.pendingPoints.toLocaleString()} <span className="text-sm font-medium">{t("profile_invite_points_unit", "points")}</span></p></div><div className="rounded-2xl border border-[#E5E5E5] bg-white p-5"><p className="text-sm text-[#727272]">{t("profile_invite_stat_credited_points", "Credited points")}</p><p className="mt-2 text-2xl font-semibold text-[#1F1F1F]">{data.totals.creditedPoints.toLocaleString()} <span className="text-sm font-medium">{t("profile_invite_points_unit", "points")}</span></p></div></section>
      <section aria-labelledby="referral-activity-heading" className="mt-6 rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6"><div className="flex items-baseline justify-between gap-4"><div><h3 id="referral-activity-heading" className="text-base font-semibold text-[#1F1F1F]">{t("profile_invite_activity_title", "Invitation activity")}</h3><p className="mt-1 text-sm text-[#727272]">{t("profile_invite_activity_subtitle", "Point credits appear only after approval.")}</p></div></div>{data.activity.length === 0 ? <p className="py-10 text-center text-sm text-[#727272]">{t("profile_invite_activity_empty", "No invitations yet. Share your link to get started.")}</p> : <div className="mt-4 divide-y divide-[#EDEDED]">{data.activity.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-[#1F1F1F]">{item.guestName}</p><p className="mt-0.5 text-xs text-[#727272]">{t("profile_invite_joined_date", { date: formatDate(item.joinedAt) })}</p></div><div className="text-left sm:text-right"><p className={`text-sm font-medium ${item.status === "CREDITED" ? "text-emerald-700" : item.status === "NOT_APPROVED" ? "text-rose-700" : "text-[#727272]"}`}>{statusCopy[item.status]}</p>{item.points !== null ? <p className="mt-0.5 text-xs text-[#727272]">{item.points.toLocaleString()} {t("profile_invite_points_unit", "points")}{item.reviewedAt ? ` · ${t("profile_invite_reviewed_date", { date: formatDate(item.reviewedAt) })}` : ""}</p> : null}</div></div>)}</div>}</section>
      <section aria-labelledby="reward-rules-heading" className="mt-6 rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6"><h3 id="reward-rules-heading" className="text-base font-semibold text-[#1F1F1F]">{t("profile_invite_reward_rules", "Reward rules")}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#727272]">{rewardCopy}</p></section>
    </div>
  );
}
