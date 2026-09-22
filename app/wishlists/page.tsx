import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { publicListingCardSelect, toPublicListingCardDTO } from "@/services/mappers";
import WishlistList from "@/components/wishlist/WishlistList";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WishlistsPage() {
  const user = await getSessionUser();

  const favorites = user
    ? await prisma.listingFavorite.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { listing: { select: publicListingCardSelect } },
      })
    : [];

  type FavoriteRow = {
    id: string;
    listingId: string;
    createdAt: Date;
    listing: Parameters<typeof toPublicListingCardDTO>[0] | null;
  };

  const items = favorites.map((f: FavoriteRow) => ({
    id: f.id,
    listingId: f.listingId,
    createdAt: f.createdAt.toISOString(),
    listing: f.listing ? toPublicListingCardDTO(f.listing) : null,
  }));

  return (
    <>
      <AppHeader />
      <main className="min-h-[60vh]">
        <div className="max-w-[1200px] mx-auto px-6 py-12">
          <h1 className="text-2xl font-semibold mb-6">Wishlists</h1>
          {!user ? (
            <div className="text-zinc-500">Please log in to view your saved properties.</div>
          ) : (
            <WishlistList items={items} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
