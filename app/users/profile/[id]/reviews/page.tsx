import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { userService } from "@/services/user.service";

function relativeDate(date: Date): string {
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

export default async function HostReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await userService.getPublicHostProfile(id, { reviewLimit: 100 }).catch(() => notFound());
  const { host, reviews, stats } = profile;
  const hostName = host.name || "Homyz host";

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <AppHeader />
      <main className="flex-1 py-8 sm:py-12">
        <Container>
          <div className="mx-auto max-w-3xl">
            <Link href={`/users/profile/${host.id}`} className="inline-flex text-sm font-medium underline underline-offset-4 hover:text-zinc-600">Back to {hostName}&apos;s profile</Link>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">{hostName}&apos;s reviews</h1>
            <p className="mt-2 text-sm text-zinc-600">{stats.reviewCount} {stats.reviewCount === 1 ? "review" : "reviews"}{stats.averageRating !== null ? ` · ${stats.averageRating.toFixed(2)} ★ average rating` : ""}</p>

            {reviews.length > 0 ? <div className="mt-9 divide-y divide-zinc-200 border-y border-zinc-200">
              {reviews.map((review) => <article key={review.id} className="py-7 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {review.author.image ? <img src={review.author.image} alt="" loading="lazy" className="size-11 rounded-full object-cover" /> : <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">{(review.author.name || "G")[0]?.toUpperCase()}</span>}
                  <div><p className="text-sm font-semibold">{review.author.name || "Guest"}</p><p className="text-xs text-zinc-500">{relativeDate(review.createdAt)}{review.listing.title ? ` · ${review.listing.title}` : ""}</p></div>
                </div>
                <p className="mt-4 text-sm" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-zinc-300">{"★".repeat(5 - review.rating)}</span></p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700">{review.comment}</p>
              </article>)}
            </div> : <p className="mt-8 rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-600">This host does not have any published written reviews yet.</p>}
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
