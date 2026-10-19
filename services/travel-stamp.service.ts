import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";

export interface TravelStampDTO {
  id: string;
  slug: string;
  title: string;
  category: string;
  imageUrl: string;
  description: string | null;
  isEarned: boolean;
  isDisplayed: boolean;
  earnedAt?: string;
}

const DEFAULT_STAMPS = [
  {
    slug: "paris",
    title: "Paris",
    category: "DESTINATION",
    imageUrl: "/images/travel/stamps/paris-stamp.svg",
    description: "City of Lights & Eiffel Tower exploration",
  },
  {
    slug: "coffee",
    title: "Coffee",
    category: "LIFESTYLE",
    imageUrl: "/images/travel/stamps/coffee-stamp.svg",
    description: "Artisan coffee lover & Italian moka pot brews",
  },
  {
    slug: "rome",
    title: "Rome",
    category: "DESTINATION",
    imageUrl: "/images/travel/stamps/rome-stamp.svg",
    description: "Colosseum & Roman architecture exploration",
  },
  {
    slug: "tokyo",
    title: "Tokyo",
    category: "DESTINATION",
    imageUrl: "/images/travel/stamps/tokyo-stamp.svg",
    description: "Futuristic neon and traditional Japanese serenity",
  },
];

export class TravelStampService {
  /**
   * Ensures default catalog stamps are populated in the database.
   */
  async ensureCatalog(): Promise<void> {
    for (const item of DEFAULT_STAMPS) {
      await prisma.travelStamp.upsert({
        where: { slug: item.slug },
        update: {
          title: item.title,
          category: item.category,
          imageUrl: item.imageUrl,
          description: item.description,
        },
        create: {
          slug: item.slug,
          title: item.title,
          category: item.category,
          imageUrl: item.imageUrl,
          description: item.description,
        },
      });
    }
  }

  /**
   * Gets stamps for a given user.
   * If user has no stamps, grants default starting stamps (Paris, Coffee).
   */
  async getUserStamps(
    userId: string,
    onlyDisplayed = false,
  ): Promise<{ stamps: TravelStampDTO[]; stampsVisible: boolean }> {
    await this.ensureCatalog();

    // Fetch user's profile to check global stamps visibility
    const profile = await prisma.travelProfile.findUnique({
      where: { userId },
      select: { stampsVisible: true },
    });

    const stampsVisible = profile?.stampsVisible ?? true;

    // Fetch all catalog stamps
    const allStamps = (await prisma.travelStamp.findMany({
      orderBy: { createdAt: "asc" },
    })) as Array<{
      id: string;
      slug: string;
      title: string;
      category: string;
      imageUrl: string;
      description: string | null;
      createdAt: Date;
    }>;

    // Fetch user's awarded stamps
    let userStamps = (await prisma.userTravelStamp.findMany({
      where: {
        userId,
        ...(onlyDisplayed ? { isDisplayed: true } : {}),
      },
      include: { stamp: true },
    })) as Array<{
      id: string;
      userId: string;
      stampId: string;
      isDisplayed: boolean;
      earnedAt: Date;
      stamp: {
        id: string;
        slug: string;
        title: string;
        category: string;
        imageUrl: string;
        description: string | null;
      };
    }>;

    // If user has none yet, auto-award default Paris & Coffee
    if (userStamps.length === 0 && !onlyDisplayed) {
      const defaultToAward = allStamps.filter(
        (s) => s.slug === "paris" || s.slug === "coffee",
      );

      for (const s of defaultToAward) {
        await prisma.userTravelStamp.upsert({
          where: {
            userId_stampId: {
              userId,
              stampId: s.id,
            },
          },
          update: {},
          create: {
            userId,
            stampId: s.id,
            isDisplayed: true,
          },
        });
      }

      userStamps = (await prisma.userTravelStamp.findMany({
        where: { userId },
        include: { stamp: true },
      })) as typeof userStamps;
    }

    const userStampMap = new Map<string, { isDisplayed: boolean; earnedAt: Date }>();
    for (const us of userStamps) {
      userStampMap.set(us.stampId, {
        isDisplayed: us.isDisplayed,
        earnedAt: us.earnedAt,
      });
    }

    if (onlyDisplayed) {
      const result: TravelStampDTO[] = userStamps
        .filter((us) => us.isDisplayed)
        .map((us) => ({
          id: us.stamp.id,
          slug: us.stamp.slug,
          title: us.stamp.title,
          category: us.stamp.category,
          imageUrl: us.stamp.imageUrl,
          description: us.stamp.description,
          isEarned: true,
          isDisplayed: true,
          earnedAt: us.earnedAt.toISOString(),
        }));
      return { stamps: result, stampsVisible };
    }

    const result: TravelStampDTO[] = allStamps.map((stamp) => {
      const userEntry = userStampMap.get(stamp.id);
      return {
        id: stamp.id,
        slug: stamp.slug,
        title: stamp.title,
        category: stamp.category,
        imageUrl: stamp.imageUrl,
        description: stamp.description,
        isEarned: Boolean(userEntry),
        isDisplayed: userEntry ? userEntry.isDisplayed : false,
        earnedAt: userEntry ? userEntry.earnedAt.toISOString() : undefined,
      };
    });

    return { stamps: result, stampsVisible };
  }

  /**
   * Toggles whether an individual stamp is displayed on the user's profile.
   */
  async toggleStampDisplay(
    userId: string,
    stampId: string,
    isDisplayed?: boolean,
  ): Promise<{ stampId: string; isDisplayed: boolean }> {
    const existing = await prisma.userTravelStamp.findUnique({
      where: {
        userId_stampId: {
          userId,
          stampId,
        },
      },
    });

    if (!existing) {
      // Award it first and set display state
      const newDisplay = typeof isDisplayed === "boolean" ? isDisplayed : true;
      const created = await prisma.userTravelStamp.create({
        data: {
          userId,
          stampId,
          isDisplayed: newDisplay,
        },
      });
      return { stampId, isDisplayed: created.isDisplayed };
    }

    const nextState =
      typeof isDisplayed === "boolean" ? isDisplayed : !existing.isDisplayed;

    const updated = await prisma.userTravelStamp.update({
      where: { id: existing.id },
      data: { isDisplayed: nextState },
    });

    return { stampId, isDisplayed: updated.isDisplayed };
  }

  /**
   * Sets profile-level stamps visibility switch.
   */
  async setProfileStampsVisibility(
    userId: string,
    stampsVisible: boolean,
  ): Promise<{ stampsVisible: boolean }> {
    const profile = await prisma.travelProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw AppError.notFound("Travel profile not found.");
    }

    const updated = await prisma.travelProfile.update({
      where: { id: profile.id },
      data: { stampsVisible },
    });

    return { stampsVisible: updated.stampsVisible };
  }
}

export const travelStampService = new TravelStampService();
