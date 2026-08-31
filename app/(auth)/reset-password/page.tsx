import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Reset Password | Homyz Enterprise Console",
  description: "Set a new secure password for your Homyz account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 bg-white text-zinc-900 font-sans flex flex-col justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left Column: Form */}
        <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center">
          {/* Logo */}
          <Link href="/" className="mb-6 flex items-center gap-3 group w-fit">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-[#FBDE9B] font-black shadow-xs transition-transform group-hover:scale-105">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-zinc-950 leading-none">
                homyz
              </span>
              <span className="text-[10px] font-extrabold tracking-wider text-amber-700 uppercase mt-1">
                Account Recovery
              </span>
            </div>
          </Link>

          {/* Heading */}
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 mb-2">
            Reset Password
          </h1>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
            Create a new confidential password to secure your account and regain access.
          </p>

          <ResetPasswordForm token={token ?? ""} />
        </div>

        {/* Right Column: Hero Photo on Desktop */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative aspect-[4/5] w-full max-w-[520px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
            <Image
              src="/images/auth-traveler-street.jpg"
              alt="Homyz Traveler"
              fill
              priority
              sizes="(min-width: 1024px) 500px, 100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 text-white">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300 mb-1">
                Account Protection
              </span>
              <h2 className="text-xl font-bold">
                Enhanced Credential Encryption
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
