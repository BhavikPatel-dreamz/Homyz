export const GUEST_NAV_ITEMS = [
  { id: "about_me", label: "About me", href: "/profile", image: "/images/icons/profile-img.jpg" },
  { id: "upcoming_trips", label: "Upcoming Trips", href: "/profile/tab/upcoming", image: "/images/icons/upcoming-trips.svg" },
  { id: "past_bookings", label: "Past Bookings", href: "/profile/tab/past", image: "/images/icons/post-bookings.svg" },
  { id: "loyalty", label: "Loyalty Points Wallet", href: "/profile/tab/loyalty", image: "/images/icons/loyalty-points-wallet.svg" },
  { id: "invite", label: "Invite & Earn", href: "/profile/tab/invite", image: "/images/icons/invite-earn.svg" },
  { id: "saved", label: "Saved Listings", href: "/profile/tab/saved", image: "/images/icons/saved-listing.svg" },
  { id: "profile_management", label: "Profile Management", href: "/profile/tab/profile_management", image: "/images/icons/profile-management.svg" },
  { id: "support", label: "Support / Chat with Agent", href: "/profile/tab/support", image: "/images/icons/support-chat-with-agent.svg" },
  { id: "notifications", label: "Notifications", href: "/profile/tab/notifications", image: "/images/icons/Notifications.svg" },
];

export type ProfileMgmtSubTab = "info" | "photos" | "stamps" | "privacy";

export interface ProfileMgmtSubTabItem {
  id: ProfileMgmtSubTab;
  slug: string;
  label: string;
  href: string;
  aliases: string[];
}

export const PROFILE_MGMT_SUB_TABS: ProfileMgmtSubTabItem[] = [
  {
    id: "info",
    slug: "profile_information",
    label: "Profile Information",
    href: "/profile/tab/profile_management/profile_information",
    aliases: ["info", "profile_information", "profile-information", "information"],
  },
  {
    id: "photos",
    slug: "trip_photos",
    label: "Trip Photos",
    href: "/profile/tab/profile_management/trip_photos",
    aliases: ["photos", "trip_photos", "trip-photos", "tripphotos"],
  },
  {
    id: "stamps",
    slug: "where_ive_been",
    label: "Where I've Been",
    href: "/profile/tab/profile_management/where_ive_been",
    aliases: ["stamps", "where_ive_been", "where-ive-been", "where_i_ve_been", "whereivebeen"],
  },
  {
    id: "privacy",
    slug: "privacy_visibility",
    label: "Privacy & Visibility",
    href: "/profile/tab/profile_management/privacy_visibility",
    aliases: ["privacy", "privacy_visibility", "privacy-visibility", "privacy_and_visibility", "visibility"],
  },
];

export function normalizeTabId(tab: string | null | undefined): string {
  if (!tab || tab === "about_me") return "about_me";
  if (tab.startsWith("upcoming")) return "upcoming_trips";
  if (tab.startsWith("past")) return "past_bookings";
  if (tab.startsWith("profile_management")) return "profile_management";
  return tab;
}

export function normalizeMgmtSubTab(subTab: string | null | undefined): ProfileMgmtSubTab {
  if (!subTab) return "info";
  const clean = subTab.toLowerCase().trim();
  for (const item of PROFILE_MGMT_SUB_TABS) {
    if (item.id === clean || item.slug === clean || item.aliases.includes(clean)) {
      return item.id;
    }
  }
  return "info";
}

export function getMgmtSubTabSlug(subTab: ProfileMgmtSubTab): string {
  const item = PROFILE_MGMT_SUB_TABS.find((t) => t.id === subTab);
  return item?.slug || "profile_information";
}

export function getMgmtSubTabHref(subTab: ProfileMgmtSubTab): string {
  const item = PROFILE_MGMT_SUB_TABS.find((t) => t.id === subTab);
  return item?.href || "/profile/tab/profile_management/profile_information";
}

export function getProfileTabHref(
  tabId: string,
  subTab?: ProfileMgmtSubTab | string,
): string {
  const normalized = normalizeTabId(tabId);
  if (normalized === "about_me") {
    return "/profile";
  }
  if (normalized === "profile_management" && subTab) {
    const subNorm = normalizeMgmtSubTab(subTab);
    const slug = getMgmtSubTabSlug(subNorm);
    return `/profile/tab/profile_management/${slug}`;
  }
  const item = GUEST_NAV_ITEMS.find((n) => n.id === normalized);
  if (item) {
    return item.href;
  }
  return `/profile/tab/${normalized}`;
}

export interface ParsedProfileRoute {
  tab: string;
  subTab: ProfileMgmtSubTab;
  rawSubTab?: string;
  hasQueryTab?: boolean;
}

export function parseProfilePathname(pathname: string): {
  tab: string;
  subTab: ProfileMgmtSubTab;
  isTabRoute: boolean;
} {
  if (!pathname || pathname === "/profile" || pathname === "/profile/") {
    return { tab: "about_me", subTab: "info", isTabRoute: false };
  }

  const match = pathname.match(/^\/profile\/tab(?:\/([^\/]+)(?:\/([^\/]+))?)?\/?$/);
  if (match) {
    const rawTab = match[1];
    const rawSubTab = match[2];
    return {
      tab: normalizeTabId(rawTab),
      subTab: normalizeMgmtSubTab(rawSubTab),
      isTabRoute: true,
    };
  }

  return { tab: "about_me", subTab: "info", isTabRoute: false };
}

export function extractProfileRoute(options?: {
  slug?: string[];
  pathname?: string;
  searchParams?: any;
  rawSearch?: string;
}): ParsedProfileRoute {
  // 1. Slug parameter from /profile/tab/[...slug]
  if (options?.slug && options.slug.length > 0) {
    const [first, ...rest] = options.slug;
    const sub = rest.length > 0 ? rest.join("/") : undefined;
    return {
      tab: normalizeTabId(first),
      subTab: normalizeMgmtSubTab(sub),
      rawSubTab: sub,
      hasQueryTab: false,
    };
  }

  // 2. Pathname from browser window or prop
  const pathname =
    options?.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : undefined);

  if (pathname && pathname.startsWith("/profile/tab")) {
    const parsed = parseProfilePathname(pathname);
    return {
      tab: parsed.tab,
      subTab: parsed.subTab,
      hasQueryTab: false,
    };
  }

  // 3. SearchParams or rawSearch fallback/backward-compatibility
  let rawTab: string | null = null;
  let rawSubTab: string | null = null;
  let hasQueryTab = false;

  if (options?.searchParams) {
    const sp = options.searchParams;
    if (typeof sp.get === "function") {
      const tabParam = sp.get("tab");
      const subParam = sp.get("subtab");
      if (tabParam) {
        rawTab = tabParam;
        hasQueryTab = true;
      }
      if (subParam) rawSubTab = subParam;

      if (typeof sp.keys === "function") {
        for (const key of sp.keys()) {
          if (key.startsWith("tab/")) {
            hasQueryTab = true;
            const remainder = key.slice(4);
            const [first, ...rest] = remainder.split("/");
            if (!rawTab) rawTab = first;
            if (!rawSubTab && rest.length > 0) rawSubTab = rest.join("/");
            break;
          }
        }
      }
    } else if (typeof sp === "object") {
      if (typeof sp.tab === "string") {
        rawTab = sp.tab;
        hasQueryTab = true;
      }
      if (typeof sp.subtab === "string") rawSubTab = sp.subtab;
      for (const key of Object.keys(sp)) {
        if (key.startsWith("tab/")) {
          hasQueryTab = true;
          const remainder = key.slice(4);
          const [first, ...rest] = remainder.split("/");
          if (!rawTab) rawTab = first;
          if (!rawSubTab && rest.length > 0) rawSubTab = rest.join("/");
          break;
        }
      }
    }
  }

  if (!rawTab) {
    const search =
      options?.rawSearch ??
      (typeof window !== "undefined" ? window.location.search : "");
    if (search) {
      const matchSlash = search.match(/[?&]tab\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_/-]+))?/);
      if (matchSlash) {
        hasQueryTab = true;
        rawTab = matchSlash[1];
        if (matchSlash[2]) rawSubTab = matchSlash[2];
      } else {
        const matchEq = search.match(/[?&]tab=([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_/-]+))?/);
        if (matchEq) {
          hasQueryTab = true;
          rawTab = matchEq[1];
          if (matchEq[2]) rawSubTab = matchEq[2];
        }
      }

      if (!rawSubTab) {
        const matchSub = search.match(/[?&]subtab=([a-zA-Z0-9_-]+)/);
        if (matchSub?.[1]) {
          rawSubTab = matchSub[1];
        }
      }
    }
  }

  if (rawTab && rawTab.includes("/")) {
    const [first, ...rest] = rawTab.split("/");
    rawTab = first;
    if (!rawSubTab && rest.length > 0) {
      rawSubTab = rest.join("/");
    }
  }

  return {
    tab: normalizeTabId(rawTab),
    subTab: normalizeMgmtSubTab(rawSubTab),
    rawSubTab: rawSubTab || undefined,
    hasQueryTab,
  };
}

export function extractTabFromQuery(
  searchParams?: any,
  rawSearch?: string,
): string {
  return extractProfileRoute({ searchParams, rawSearch }).tab;
}

export function extractSubTabFromQuery(
  searchParams?: any,
  rawSearch?: string,
): ProfileMgmtSubTab {
  return extractProfileRoute({ searchParams, rawSearch }).subTab;
}

