import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";

export const metadata = {
  title: "Help Centre - Homyz",
  description: "Find help, guides, and answers to common questions on Homyz.",
};

export default function HelpCentrePage() {
  const helpCategories = [
    {
      title: "Booking & Reservations",
      description: "How to search, reserve, change, or cancel your reservations.",
      icon: "📅",
      link: "/profile/tab/upcoming",
    },
    {
      title: "Payments & Refunds",
      description: "Understanding pricing, fees, payment methods, and refund policies.",
      icon: "💳",
      link: "/profile-management",
    },
    {
      title: "Your Account & Profile",
      description: "Manage your credentials, preferences, notifications, and identity.",
      icon: "👤",
      link: "/profile",
    },
    {
      title: "Hosting on Homyz",
      description: "Getting started as a host, managing listings, and host safety.",
      icon: "🏠",
      link: "/host/listings",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-16">
        <Container>
          <div className="mx-auto max-w-4xl space-y-10">
            <div className="text-center space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
                How can we help you?
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 max-w-xl mx-auto">
                Explore popular topics, browse guides, or get in touch with our 24/7 customer support team.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {helpCategories.map((cat) => (
                <Link
                  key={cat.title}
                  href={cat.link}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all flex items-start gap-4 shadow-2xs"
                >
                  <span className="text-3xl shrink-0" aria-hidden="true">{cat.icon}</span>
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">{cat.title}</h2>
                    <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{cat.description}</p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-zinc-900">Need personalized support?</h3>
                <p className="text-xs text-zinc-600">
                  Our customer experience specialists are ready to assist you any time.
                </p>
              </div>
              <Link
                href="/profile/tab/support"
                className="shrink-0 rounded-full bg-[#1F1F1F] text-white px-6 py-3 text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Chat with Support
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

