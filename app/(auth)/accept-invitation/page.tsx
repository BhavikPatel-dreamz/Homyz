import Link from "next/link";
import Image from "next/image";
import { AcceptInvitationForm } from "@/components/forms/accept-invitation-form";
import { invitationService } from "@/services/invitation.service";

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
    return (
      <div className="w-full max-w-md mx-auto py-12 px-4 font-sans">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="mb-2">Invalid Invitation Link</h1>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
            This invitation link is missing its security token or has already been consumed.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3 text-xs font-semibold text-[#1F1F1F] transition-colors shadow-2xs"
          >
            ← Return to Sign In
          </Link>
        </div>
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
      <div className="w-full max-w-md mx-auto py-12 px-4 font-sans">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center flex flex-col gap-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1>
            Unable to Accept Invitation
          </h1>
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 font-medium">
            {errorMsg}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            If your link has expired or was revoked, please request a new invitation link from your system administrator.
          </p>
          <div className="pt-2">
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3 text-xs font-semibold text-[#1F1F1F] transition-colors shadow-2xs"
            >
              Go to Sign In →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 bg-white text-[#1F1F1F] font-sans flex flex-col justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left Column: Setup Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center">
          {/* Header */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 mb-3">
              🛡️ Homyz Admin Setup
            </span>
            <h1>
              Set Up Your Account
            </h1>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Create a confidential password to complete your account activation and access the Homyz Admin Console.
            </p>
          </div>

          <AcceptInvitationForm
            token={token}
            email={invitation.email}
            name={invitation.name}
            roleName={invitation.adminRoleName || invitation.role}
          />
        </div>

        {/* Right Column: Hero Photo on Desktop */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative aspect-[4/5] w-full max-w-[520px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
            <Image
              src="/images/auth-traveler-street.jpg"
              alt="Homyz Admin Portal"
              fill
              priority
              sizes="(min-width: 1024px) 500px, 100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 text-white">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-300 mb-1">
                Enterprise Administration
              </span>
              <h2 className="text-xl font-semibold">
                Secure Access & Infrastructure Management
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
