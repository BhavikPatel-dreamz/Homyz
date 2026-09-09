import { CoHostInvitationAcceptance } from "./co-host-invitation-acceptance";

export default async function CoHostInvitationAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <CoHostInvitationAcceptance token={token ?? ""} />;
}
