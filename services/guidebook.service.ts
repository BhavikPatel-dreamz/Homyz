import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import { Role } from "@/generated/prisma/enums";
import type {
  CreateGuidebookInput,
  UpdateGuidebookInput,
  CreateGuidebookItemInput,
  UpdateGuidebookItemInput,
} from "@/lib/validation/guidebook";

export class GuidebookService {
  /**
   * Retrieves all guidebooks owned by the authenticated host.
   */
  async getGuidebooksForHost(actor: AuthUser) {
    const guidebooks = await prisma.guidebook.findMany({
      where: actor.role === Role.ADMIN ? {} : { hostId: actor.id },
      orderBy: { updatedAt: "desc" },
      include: {
        listings: {
          include: {
            listing: {
              select: { id: true, title: true, city: true, photos: true },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    return guidebooks.map((gb: any) => ({
      id: gb.id,
      hostId: gb.hostId,
      title: gb.title,
      coverImage: gb.coverImage,
      description: gb.description,
      city: gb.city,
      state: gb.state,
      country: gb.country,
      formattedAddress: gb.formattedAddress,
      published: gb.published,
      itemsCount: gb._count.items,
      createdAt: gb.createdAt.toISOString(),
      updatedAt: gb.updatedAt.toISOString(),
      listings: gb.listings.map((l: any) => ({
        id: l.listing.id,
        title: l.listing.title,
        city: l.listing.city,
        coverPhoto: l.listing.photos[0] || null,
      })),
    }));
  }

  /**
   * Retrieves a single guidebook with all recommendations and linked listings.
   */
  async getGuidebookById(actor: AuthUser, id: string) {
    const guidebook = await prisma.guidebook.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
        listings: {
          include: {
            listing: {
              select: { id: true, title: true, city: true, address: true, photos: true },
            },
          },
        },
        host: {
          select: { id: true, name: true, image: true, createdAt: true },
        },
      },
    });

    if (!guidebook) {
      throw AppError.notFound("Guidebook not found");
    }

    if (actor.role !== Role.ADMIN && guidebook.hostId !== actor.id) {
      throw AppError.forbidden("You do not have access to this guidebook");
    }

    return {
      id: guidebook.id,
      hostId: guidebook.hostId,
      title: guidebook.title,
      coverImage: guidebook.coverImage,
      description: guidebook.description,
      city: guidebook.city,
      state: guidebook.state,
      country: guidebook.country,
      countryCode: guidebook.countryCode,
      latitude: guidebook.latitude,
      longitude: guidebook.longitude,
      formattedAddress: guidebook.formattedAddress,
      published: guidebook.published,
      createdAt: guidebook.createdAt.toISOString(),
      updatedAt: guidebook.updatedAt.toISOString(),
      host: guidebook.host,
      items: guidebook.items.map((item: any) => ({
        id: item.id,
        guidebookId: item.guidebookId,
        type: item.type as "PLACE" | "NEIGHBORHOOD" | "TIP",
        title: item.title,
        category: item.category,
        description: item.description,
        hostTip: item.hostTip,
        photo: item.photo,
        placeProviderId: item.placeProviderId,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        isFavorite: item.isFavorite,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      listings: guidebook.listings.map((l: any) => ({
        id: l.listing.id,
        title: l.listing.title,
        city: l.listing.city,
        address: l.listing.address,
        coverPhoto: l.listing.photos[0] || null,
      })),
    };
  }

  /**
   * Public guest-facing guidebook view.
   */
  async getPublicGuidebook(id: string, viewerId?: string | null) {
    const guidebook = await prisma.guidebook.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
        listings: {
          include: {
            listing: {
              select: { id: true, title: true, city: true, photos: true },
            },
          },
        },
        host: {
          select: { id: true, name: true, image: true, createdAt: true },
        },
      },
    });

    if (!guidebook) {
      throw AppError.notFound("Guidebook not found");
    }

    // If draft, only the owner can view
    if (!guidebook.published && guidebook.hostId !== viewerId) {
      throw AppError.notFound("This guidebook is not currently published.");
    }

    return {
      id: guidebook.id,
      title: guidebook.title,
      coverImage: guidebook.coverImage,
      description: guidebook.description,
      city: guidebook.city,
      state: guidebook.state,
      country: guidebook.country,
      formattedAddress: guidebook.formattedAddress,
      published: guidebook.published,
      updatedAt: guidebook.updatedAt.toISOString(),
      host: {
        id: guidebook.host.id,
        name: guidebook.host.name || "Host",
        image: guidebook.host.image,
        yearsHosting: guidebook.host.createdAt
          ? Math.max(0, new Date().getFullYear() - new Date(guidebook.host.createdAt).getFullYear())
          : 0,
      },
      items: guidebook.items.map((item: any) => ({
        id: item.id,
        type: item.type as "PLACE" | "NEIGHBORHOOD" | "TIP",
        title: item.title,
        category: item.category,
        description: item.description,
        hostTip: item.hostTip,
        photo: item.photo,
        placeProviderId: item.placeProviderId,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        isFavorite: item.isFavorite,
        sortOrder: item.sortOrder,
      })),
      listings: guidebook.listings.map((l: any) => ({
        id: l.listing.id,
        title: l.listing.title,
        city: l.listing.city,
        coverPhoto: l.listing.photos[0] || null,
      })),
    };
  }

  /**
   * Retrieves guidebooks linked to a specific listing.
   */
  async getGuidebooksForListing(listingId: string) {
    const links = await prisma.guidebookListing.findMany({
      where: {
        listingId,
        guidebook: { published: true },
      },
      include: {
        guidebook: {
          include: {
            host: { select: { id: true, name: true, image: true } },
            _count: { select: { items: true } },
          },
        },
      },
    });

    return links.map((l: any) => ({
      id: l.guidebook.id,
      title: l.guidebook.title,
      coverImage: l.guidebook.coverImage,
      city: l.guidebook.city,
      itemsCount: l.guidebook._count.items,
      host: l.guidebook.host,
    }));
  }

  /**
   * Creates a new Guidebook and links specified listings.
   */
  async create(actor: AuthUser, input: CreateGuidebookInput) {
    const { listingIds, ...data } = input;

    // Verify host owns all listings to be associated
    if (listingIds && listingIds.length > 0 && actor.role !== Role.ADMIN) {
      const ownedCount = await prisma.listing.count({
        where: {
          id: { in: listingIds },
          hostId: actor.id,
        },
      });
      if (ownedCount !== listingIds.length) {
        throw AppError.forbidden("You can only associate guidebooks with listings you own.");
      }
    }

    const guidebook = await prisma.guidebook.create({
      data: {
        ...data,
        hostId: actor.id,
        listings: listingIds && listingIds.length > 0
          ? {
              create: listingIds.map((listingId) => ({
                listing: { connect: { id: listingId } },
              })),
            }
          : undefined,
      },
      include: {
        listings: { select: { listingId: true } },
      },
    });

    return guidebook;
  }

  /**
   * Updates guidebook metadata.
   */
  async update(actor: AuthUser, id: string, input: UpdateGuidebookInput) {
    const existing = await prisma.guidebook.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, existing.hostId);

    const updated = await prisma.guidebook.update({
      where: { id },
      data: input,
    });

    return updated;
  }

  /**
   * Deletes a guidebook.
   */
  async remove(actor: AuthUser, id: string) {
    const existing = await prisma.guidebook.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, existing.hostId);

    await prisma.guidebook.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Adds an item (Place, Neighborhood, or Tip) to a guidebook.
   */
  async addItem(actor: AuthUser, guidebookId: string, input: CreateGuidebookItemInput) {
    const guidebook = await prisma.guidebook.findUnique({ where: { id: guidebookId } });
    if (!guidebook) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, guidebook.hostId);

    // Duplicate prevention for places
    if (input.type === "PLACE") {
      const duplicate = await prisma.guidebookItem.findFirst({
        where: {
          guidebookId,
          OR: [
            input.placeProviderId ? { placeProviderId: input.placeProviderId } : undefined,
            {
              title: { equals: input.title, mode: "insensitive" },
              address: input.address ? { equals: input.address, mode: "insensitive" } : undefined,
            },
          ].filter(Boolean) as any,
        },
      });

      if (duplicate) {
        throw AppError.conflict(
          `"${input.title}" is already in your guidebook. You can edit the existing recommendation.`
        );
      }
    }

    // Determine sort order
    const maxSort = await prisma.guidebookItem.aggregate({
      where: { guidebookId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const item = await prisma.guidebookItem.create({
      data: {
        ...input,
        sortOrder: input.sortOrder !== undefined && input.sortOrder !== 0 ? input.sortOrder : nextSortOrder,
        guidebookId,
      },
    });

    // Touch guidebook updatedAt
    await prisma.guidebook.update({
      where: { id: guidebookId },
      data: { updatedAt: new Date() },
    });

    return item;
  }

  /**
   * Updates an existing item.
   */
  async updateItem(
    actor: AuthUser,
    guidebookId: string,
    itemId: string,
    input: UpdateGuidebookItemInput
  ) {
    const guidebook = await prisma.guidebook.findUnique({ where: { id: guidebookId } });
    if (!guidebook) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, guidebook.hostId);

    const existingItem = await prisma.guidebookItem.findFirst({
      where: { id: itemId, guidebookId },
    });
    if (!existingItem) throw AppError.notFound("Recommendation item not found");

    const item = await prisma.guidebookItem.update({
      where: { id: itemId },
      data: input,
    });

    await prisma.guidebook.update({
      where: { id: guidebookId },
      data: { updatedAt: new Date() },
    });

    return item;
  }

  /**
   * Removes an item from a guidebook.
   */
  async removeItem(actor: AuthUser, guidebookId: string, itemId: string) {
    const guidebook = await prisma.guidebook.findUnique({ where: { id: guidebookId } });
    if (!guidebook) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, guidebook.hostId);

    const existingItem = await prisma.guidebookItem.findFirst({
      where: { id: itemId, guidebookId },
    });
    if (!existingItem) throw AppError.notFound("Recommendation item not found");

    await prisma.guidebookItem.delete({ where: { id: itemId } });

    await prisma.guidebook.update({
      where: { id: guidebookId },
      data: { updatedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Reorders items inside a guidebook.
   */
  async reorderItems(actor: AuthUser, guidebookId: string, itemIds: string[]) {
    const guidebook = await prisma.guidebook.findUnique({ where: { id: guidebookId } });
    if (!guidebook) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, guidebook.hostId);

    await prisma.$transaction(
      itemIds.map((id, index) =>
        prisma.guidebookItem.updateMany({
          where: { id, guidebookId },
          data: { sortOrder: index },
        })
      )
    );

    await prisma.guidebook.update({
      where: { id: guidebookId },
      data: { updatedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Updates which host-owned listings this guidebook is shown on.
   */
  async setListingAssociations(actor: AuthUser, guidebookId: string, listingIds: string[]) {
    const guidebook = await prisma.guidebook.findUnique({ where: { id: guidebookId } });
    if (!guidebook) throw AppError.notFound("Guidebook not found");
    assertOwnership(actor, guidebook.hostId);

    // Verify host owns all target listings
    if (listingIds.length > 0 && actor.role !== Role.ADMIN) {
      const count = await prisma.listing.count({
        where: {
          id: { in: listingIds },
          hostId: actor.id,
        },
      });
      if (count !== listingIds.length) {
        throw AppError.forbidden("You can only associate guidebooks with listings you own.");
      }
    }

    await prisma.$transaction([
      prisma.guidebookListing.deleteMany({ where: { guidebookId } }),
      ...(listingIds.length > 0
        ? [
            prisma.guidebookListing.createMany({
              data: listingIds.map((listingId) => ({
                guidebookId,
                listingId,
              })),
            }),
          ]
        : []),
      prisma.guidebook.update({
        where: { id: guidebookId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return { success: true };
  }
}

export const guidebookService = new GuidebookService();
