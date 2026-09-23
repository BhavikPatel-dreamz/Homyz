import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { userService } from "@/services/user.service";
import { getCurrencyForCountry } from "@/lib/currency";
import { CurrencyPrice } from "@/components/ui/currency-price";

function relativeDate(date: Date): string {
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

function yearsOnHomyz(createdAt: Date): string {
  const now = new Date();
  const years = Math.max(0, now.getFullYear() - createdAt.getFullYear() - (now.getMonth() < createdAt.getMonth() ? 1 : 0));
  return years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : "Less than a year";
}

export default async function PublicHostProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await userService.getPublicHostProfile(id).catch(() => notFound());
  const { host, stats, reviews, listings } = profile;
  const hostName = host.name || "Homyz host";
  const profileData = host.publicProfile;
  const hostBio = typeof profileData.bio === "string" ? profileData.bio.trim() : "";
  const work = typeof profileData.myWork === "string" ? profileData.myWork.trim() : "";
  const languages = Array.isArray(profileData.languages)
    ? profileData.languages.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : typeof profileData.languages === "string" && profileData.languages.trim() ? [profileData.languages.trim()] : [];

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <AppHeader />
      <main className="flex-1 py-8 sm:py-12">
        <Container>
          <div className="mx-auto max-w-5xl">
            <h1 className="sr-only">{hostName}&apos;s host profile</h1>
            <section className="grid gap-8 border-b border-zinc-200 pb-9 md:grid-cols-[280px_minmax(0,1fr)] md:gap-12">
              <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                <div className="flex items-start gap-4">
                  {host.image ? (
                    <img src={host.image} alt={`${hostName}'s profile photo`} loading="lazy" decoding="async" className="size-20 rounded-full border border-zinc-200 object-cover" />
                  ) : (
                    <div aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-amber-100 text-2xl font-semibold text-amber-900">{hostName[0]?.toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1 divide-y divide-zinc-200">
                    {stats.reviewCount > 0 ? <div className="pb-2 text-[10px] text-zinc-500"><span className="block text-base font-semibold leading-5 text-zinc-900">{stats.reviewCount}</span>{stats.reviewCount === 1 ? "Review" : "Reviews"}</div> : <div className="pb-2 text-[10px] text-zinc-500"><span className="block text-base font-semibold leading-5 text-zinc-900">New</span>Host</div>}
                    {stats.averageRating !== null && <div className="py-2 text-[10px] text-zinc-500"><span className="flex items-center gap-1 text-base font-semibold leading-5 text-zinc-900">{stats.averageRating.toFixed(2)} <span aria-hidden="true" className="text-amber-500">★</span></span>Rating</div>}
                    <div className={`${stats.reviewCount > 0 || stats.averageRating !== null ? "pt-2" : ""} text-[10px] text-zinc-500`}><span className="block text-base font-semibold leading-5 text-zinc-900">{yearsOnHomyz(host.createdAt)}</span>on Homyz</div>
                  </div>
                </div>
                <div className="mt-4 text-center"><p className="break-words text-xl font-semibold">{hostName}</p><p className="mt-1 text-xs text-zinc-600">{host.isSuperhost ? "Superhost" : "Host"}</p></div>
              </div>

              <div className="pt-1">
                <h2 className="text-2xl font-semibold tracking-tight">About {hostName}</h2>
                {host.isSuperhost && <p className="mt-3 flex items-center gap-2 text-sm font-medium text-zinc-800"><span aria-hidden="true">★</span> Superhost</p>}
                {hostBio && <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-6 text-zinc-700">{hostBio}</p>}
                {(work || languages.length > 0) && <div className="mt-6 space-y-3 text-sm text-zinc-700">
                  {work && <p>My work: {work}</p>}
                  {languages.length > 0 && <p>Speaks {languages.join(", ")}</p>}
                </div>}
              </div>
            </section>

            <section className="border-b border-zinc-200 py-9" aria-labelledby="host-reviews-heading">
              <h2 id="host-reviews-heading" className="text-lg font-semibold">{hostName}&apos;s reviews</h2>
              {reviews.length > 0 ? <>
                <div className="mt-6 grid gap-5 md:grid-cols-3">
                  {reviews.map((review) => <article key={review.id} className="min-w-0 border-zinc-200 md:border-r md:pr-5 last:border-r-0">
                    <div className="flex items-center gap-2.5">
                      {review.author.image ? <img src={review.author.image} alt="" loading="lazy" className="size-9 rounded-full object-cover" /> : <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{(review.author.name || "G")[0]?.toUpperCase()}</span>}
                      <div><p className="text-xs font-semibold text-zinc-900">{review.author.name || "Guest"}</p><p className="text-[10px] text-zinc-500">{relativeDate(review.createdAt)}</p></div>
                    </div>
                    <p className="mt-3 text-xs text-zinc-800"><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-zinc-300">{"★".repeat(5 - review.rating)}</span></span></p>
                    <p className="mt-2 line-clamp-3 text-sm leading-5 text-zinc-700">{review.comment}</p>
                  </article>)}
                </div>
                {stats.reviewCount > reviews.length && <Link href={`/users/profile/${host.id}/reviews`} className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">Show more reviews</Link>}
              </> : <p className="mt-4 text-sm text-zinc-600">No published reviews yet.</p>}
            </section>

            {listings.length > 0 && <section className="py-9" aria-labelledby="host-listings-heading">
              <h2 id="host-listings-heading" className="text-lg font-semibold">{hostName}&apos;s listings</h2>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {listings.map((listing) => <Link key={listing.id} href={`/listings/${listing.customSlug || listing.id}`} className="group min-w-0">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-zinc-100">
                    {listing.photos[0] ? <img src={listing.photos[0]} alt={listing.title} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex size-full items-center justify-center text-xs text-zinc-400">No photo</div>}
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-zinc-900">{listing.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-500">{[listing.city, listing.country].filter(Boolean).join(", ")}</p>
                  <p className="mt-1 text-[11px] text-zinc-700"><CurrencyPrice amountMinorUnits={listing.price} sourceCurrency={getCurrencyForCountry(listing.country)} /> / night</p>
                </Link>)}
              </div>
            </section>}
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
