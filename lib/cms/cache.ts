import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Perform targeted cache invalidation when CMS content is published, unpublished, or rolled back.
 * Never flushes unrelated application routes or bookings.
 */
export async function invalidateCmsCache(type: string, slug?: string | null) {
  try {
    // Invalidate global CMS cache tag
    revalidateTag("cms-content");
    revalidateTag(`cms-${type.toLowerCase()}`);
    if (slug) {
      revalidateTag(`cms-${type.toLowerCase()}-${slug}`);
    }

    // Invalidate affected frontend pages
    switch (type) {
      case "HOMEPAGE_BANNER":
      case "HERO_SECTION":
      case "FEATURED_CITIES":
      case "FEATURED_LISTINGS":
      case "ANNOUNCEMENT_BAR":
        revalidatePath("/");
        break;
      case "STATIC_PAGE":
        if (slug) {
          revalidatePath(`/${slug}`);
        }
        break;
      case "FAQ_ITEM":
      case "FAQ_CATEGORY":
        revalidatePath("/help");
        break;
      case "NAVIGATION_CONFIG":
      case "FOOTER_CONFIG":
        revalidatePath("/", "layout");
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn("[cms-cache] Cache revalidation warning:", err);
  }
}

