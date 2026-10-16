import { redirect } from "next/navigation";

/** Preserve the referral code through signup; the server validates it on use. */
export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/register?ref=${encodeURIComponent(code)}`);
}
