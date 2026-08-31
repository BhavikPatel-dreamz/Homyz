import Link from "next/link";
import { AcceptInvitationForm } from "@/components/forms/accept-invitation-form";
import { Card, Alert } from "@/components/ui";
import { invitationService } from "@/services/invitation.service";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-md w-full p-4">
        <Card>
          <div className="text-center py-4">
            <h1 className="text-xl font-bold text-zinc-900 mb-2">Invalid Invitation Link</h1>
            <Alert tone="error">This invitation link is missing its security token.</Alert>
            <div className="mt-6">
              <Link href="/login" className="text-sm font-semibold text-amber-600 hover:text-amber-700">
                ← Return to Sign In
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  let invitation: any = null;
  let errorMsg: string | null = null;

  try {
    invitation = await invitationService.validateToken(token);
  } catch (err: any) {
    errorMsg = err.message || "Invalid or expired invitation token.";
  }

  if (errorMsg || !invitation) {
    return (
      <div className="mx-auto max-w-md w-full p-4">
        <Card>
          <div className="flex flex-col gap-4 text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Unable to Accept Invitation
            </h1>
            <Alert tone="error">{errorMsg}</Alert>
            <p className="text-xs text-zinc-500">
              If your link has expired or was revoked, please request a new invitation from your administrator.
            </p>
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Link href="/login" className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                Go to Sign In →
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md w-full p-4">
      <Card>
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
            Homyz Admin Setup
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Set Up Your Admin Account
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create a confidential password to complete your account activation.
          </p>
        </div>

        <AcceptInvitationForm
          token={token}
          email={invitation.email}
          name={invitation.name}
          roleName={invitation.adminRoleName || invitation.role}
        />
      </Card>
    </div>
  );
}
