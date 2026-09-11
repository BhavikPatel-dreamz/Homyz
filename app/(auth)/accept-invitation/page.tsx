import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { AuthHeroImage } from "@/components/auth/auth-hero-image";
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
      <div className="account-page flex min-h-screen w-full flex-col overflow-x-hidden bg-white font-sans text-[#1F1F1F] selection:bg-amber-100">
        <AppHeader />
        <main className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-zinc-900">Invalid Invitation Link</h1>
            <p className="text-xs sm:text-sm text-zinc-500 mb-6 leading-relaxed">
              This invitation link is missing its security token or has already been consumed.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3 text-xs sm:text-sm font-semibold text-[#1F1F1F] transition-colors shadow-2xs"
            >
              ← Return to Sign In
            </Link>
          </div>
        </main>
        <Footer />
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
      <div className="account-page flex min-h-screen w-full flex-col overflow-x-hidden bg-white font-sans text-[#1F1F1F] selection:bg-amber-100">
        <AppHeader />
        <main className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs text-center flex flex-col gap-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Unable to Accept Invitation
            </h1>
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 font-medium">
              {errorMsg}
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              If your link has expired or was revoked, please request a new invitation link from your system administrator.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3 text-xs sm:text-sm font-semibold text-[#1F1F1F] transition-colors shadow-2xs"
              >
                Go to Sign In →
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="account-page flex min-h-screen w-full flex-col overflow-x-hidden bg-white font-sans text-[#1F1F1F] selection:bg-amber-100">
      <AppHeader />

      <main className="flex w-full flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-8 lg:items-center lg:px-8 lg:py-14">
        <div className="mx-auto flex w-full max-w-[1318px] flex-col items-center justify-between gap-8 lg:flex-row lg:gap-8 xl:gap-[56px]">
          {/* Left Column: Setup Form */}
          <div className="mx-auto flex w-full max-w-[538px] flex-col lg:mx-0 lg:w-1/2 lg:max-w-none xl:w-[643px]">
            {/* Header / Title area with Slide Back Button */}
            <div className="mb-2 flex flex-col gap-6 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full border border-[#727272] bg-[#F3F4F5] text-[#1F1F1F] transition-colors hover:bg-zinc-200 sm:self-auto"
                aria-label="Go back to login"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <h1 className="wrap-break-words">Accept Invitation</h1>
            </div>

            {/* Subtitle */}
            <p className="mb-2 pl-0 font-['Poppins'] text-[15px] font-normal leading-relaxed text-[#727272] sm:mb-4 sm:pl-13.5 sm:text-[17px] lg:mb-6 lg:text-[18px]">
              Set up your administrator account and create a confidential password to complete activation.
            </p>

            {/* Mobile/Tablet Hero Image */}
            <AuthHeroImage
              mobile
              src="/images/auth-traveler-street.jpg"
              alt="Homyz Admin Setup"
            />

            {/* FORM CONTAINER */}
            <div className="flex w-full max-w-[538px] flex-col pl-0 lg:pl-13.5">
              <AcceptInvitationForm
                token={token}
                email={invitation.email}
                name={invitation.name}
                roleName={invitation.adminRoleName || invitation.role}
              />
            </div>
          </div>

          {/* Right Column: Hero Photo on Desktop */}
          <AuthHeroImage
            src="/images/auth-traveler-street.jpg"
            alt="Homyz Admin Setup"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
