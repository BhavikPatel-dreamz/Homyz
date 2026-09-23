import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { CurrencyPrice } from "@/components/ui/currency-price";

export const metadata = {
  title: "Gift Cards - Homyz",
  description: "Give the gift of unforgettable getaways and stays with Homyz Gift Cards.",
};

export default function GiftCardsPage() {
  const denominations = [250, 500, 1000, 2500, 5000];

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-10">
            <div className="text-center space-y-3">
              <span className="text-4xl" aria-hidden="true">🎁</span>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
                Homyz Gift Cards
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 max-w-lg mx-auto">
                Give your loved ones the freedom to explore dream stays across Saudi Arabia and beyond.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-linear-to-br from-amber-50 to-orange-50/40 p-8 shadow-sm text-center space-y-6">
              <h2 className="text-xl font-bold text-zinc-900">Choose an amount</h2>
              <div className="flex flex-wrap justify-center gap-3">
                {denominations.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="rounded-2xl border border-amber-300 bg-white px-5 py-3 text-sm font-bold text-zinc-900 hover:bg-amber-100/70 transition-colors shadow-2xs"
                  >
                    <CurrencyPrice amountMinorUnits={amount * 100} sourceCurrency="SAR" />
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                Never expires · Valid for any listing or stay on Homyz.
              </p>
              <div>
                <Link
                  href="/listings"
                  className="inline-flex rounded-full bg-[#1F1F1F] text-white px-8 py-3.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
                >
                  Explore Stays
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
