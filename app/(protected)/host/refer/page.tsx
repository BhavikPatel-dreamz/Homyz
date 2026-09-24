import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";

export const metadata = {
  title: "Refer a Host - Homyz",
  description: "Refer friends to host on Homyz and earn rewards.",
};

export default function ReferAHostPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              🤝
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
                Refer a Host, Earn Rewards
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 max-w-md mx-auto">
                Know someone with a great space? Invite them to become a Homyz host and earn bonus credit when they complete their first booking.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8 space-y-4 text-left">
              <h2 className="text-base font-bold text-zinc-900">How it works</h2>
              <ol className="space-y-3 text-xs sm:text-sm text-zinc-600 list-decimal list-inside">
                <li>Share your referral link with a prospective host.</li>
                <li>They publish their first listing on Homyz.</li>
                <li>Once they complete their first qualified reservation, you both receive bonus rewards.</li>
              </ol>
            </div>

            <div>
              <Link
                href="/host/onboarding"
                className="inline-flex rounded-full bg-[#1F1F1F] text-white px-8 py-3.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Become a Host Yourself
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

