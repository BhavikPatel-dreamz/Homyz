import { CoHostInvitationAcceptance } from "./co-host-invitation-acceptance";

export const metadata = {
  title: "Accept co-host invitation | Homyz",
  description: "Securely accept a Homyz listing co-host invitation.",
};

export default async function CoHostInvitationAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <CoHostInvitationAcceptance token={token ?? ""} />;
}
