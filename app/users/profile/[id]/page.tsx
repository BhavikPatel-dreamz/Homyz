import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { userService } from "@/services/user.service";
import { ListingCard } from "@/components/listings/listing-card";
import { PublicHostIdentityCard } from "@/components/users/public-host-identity-card";

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
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />
      <main className="w-full flex-1 pb-13 pt-5 sm:pt-7">
        <Container>
          <div className="mx-auto w-full max-w-[1262px]">
            <h1 className="sr-only">{hostName}&apos;s host profile</h1>
            <section className="grid gap-8 border-b border-zinc-200/80 py-7.5 sm:py-12 md:grid-cols-[376px_minmax(0,1fr)] md:gap-16" aria-labelledby="about-host-heading">
              <PublicHostIdentityCard name={hostName} image={host.image} isSuperhost={host.isSuperhost} reviewCount={stats.reviewCount} averageRating={stats.averageRating} tenure={yearsOnHomyz(host.createdAt)} />
              <div className="min-w-0 pt-1">
                <h2 id="about-host-heading" className="text-[20px] font-normal text-[#1f1f1f]">About {hostName}</h2>
                {host.isSuperhost && <p className="mt-2 flex items-center gap-1.5 text-base text-[#727272]"><span aria-hidden="true">★</span> Superhost</p>}
                {hostBio && <p className="mt-2 max-w-2xl whitespace-pre-line text-base font-normal leading-6 text-[#727272]">{hostBio}</p>}
                {(work || languages.length > 0) && <div className="mt-7 space-y-4 text-base text-[#1f1f1f]">
                  {work && <p>My work: {work}</p>}
                  {languages.length > 0 && <p>Speaks {languages.join(", ")}</p>}
                </div>}
              </div>
            </section>

            <section className="border-b border-zinc-200/80 py-8 sm:py-12" aria-labelledby="host-reviews-heading">
              <h2 id="host-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">{hostName}&apos;s reviews</h2>
              {reviews.length > 0 ? <>
                <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
                  {reviews.map((review) => <article key={review.id} className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      {review.author.image ? <img src={review.author.image} alt="" loading="lazy" className="size-12 rounded-full border-2 border-[#e9a400] object-cover" /> : <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full border-2 border-[#e9a400] bg-amber-100 text-sm font-semibold text-amber-950">{(review.author.name || "G")[0]?.toUpperCase()}</span>}
                      <div><p className="text-sm font-medium text-[#1f1f1f]">{review.author.name || "Guest"}</p><p className="text-xs text-[#727272]">{relativeDate(review.createdAt)}</p></div>
                    </div>
                    <p className="mt-3 text-sm text-[#1f1f1f]"><span aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-zinc-300">{"★".repeat(5 - review.rating)}</span></span></p>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#727272] sm:text-base">{review.comment}</p>
                  </article>)}
                </div>
                {stats.reviewCount > reviews.length && <Link href={`/users/profile/${host.id}/reviews`} className="mt-8 inline-flex min-h-12 items-center rounded-full border border-[#1f1f1f] bg-white px-6 text-base font-normal text-[#1f1f1f] transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">Show all {stats.reviewCount} reviews</Link>}
              </> : <p className="mt-3 text-sm font-normal text-[#727272]">No published reviews yet.</p>}
            </section>

            {listings.length > 0 && <section className="py-8 sm:py-12" aria-labelledby="host-listings-heading">
              <h2 id="host-listings-heading" className="text-[20px] font-normal text-[#1f1f1f]">{hostName}&apos;s listings</h2>
              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {listings.map((listing, index) => <ListingCard key={listing.id} listing={listing} showFavorite={false} priority={index < 4} variant="search-grid" />)}
              </div>
            </section>}
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
