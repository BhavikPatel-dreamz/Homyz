import { invitationService, type PublicInvitation } from "@/services/invitation.service";
import { AcceptInvitationClient } from "./accept-invitation-client";

export const metadata = {
  title: "Admin Account Setup | Homyz Enterprise Console",
  description: "Set up your secure password and activate your administrative access for the Homyz platform.",
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <AcceptInvitationClient tokenMissing />;
  }

  let invitation: PublicInvitation | null = null;
  let errorMsg: string | null = null;

  try {
    invitation = await invitationService.validateToken(token);
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : "Invalid or expired invitation token.";
  }

  if (errorMsg || !invitation) {
    return <AcceptInvitationClient errorMsg={errorMsg} token={token} />;
  }

  return (
    <AcceptInvitationClient
      token={token}
      email={invitation.email}
      name={invitation.name}
      roleName={invitation.adminRoleName || invitation.role}
    />
  );
}
