import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";

export const metadata = {
  title: "Find a Co-Host - Homyz",
  description: "Partner with an experienced local co-host to manage your property.",
};

export default function FindCoHostPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              🗝️
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
                Find an Experienced Co-Host
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 max-w-md mx-auto">
                Connect with top-rated local hosts in your city who can help manage guest messaging, check-ins, cleaning, and maintenance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                <span className="text-2xl" aria-hidden="true">💬</span>
                <h3 className="text-sm font-semibold text-zinc-900">Guest Communication</h3>
                <p className="text-xs text-zinc-500">24/7 guest support, check-in coordination, and inquiry responses.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                <span className="text-2xl" aria-hidden="true">🧹</span>
                <h3 className="text-sm font-semibold text-zinc-900">Cleaning & Staging</h3>
                <p className="text-xs text-zinc-500">Turnovers, professional cleaning management, and restocking amenities.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                <span className="text-2xl" aria-hidden="true">📈</span>
                <h3 className="text-sm font-semibold text-zinc-900">Dynamic Pricing</h3>
                <p className="text-xs text-zinc-500">Local rate optimization to maximize occupancy and revenue.</p>
              </div>
            </div>

            <div>
              <Link
                href="/host/listings"
                className="inline-flex rounded-full bg-[#1F1F1F] text-white px-8 py-3.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Manage Your Listings
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

