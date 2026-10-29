import { LoyaltyActivityFeed } from "@/components/loyalty/loyalty-activity-feed";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { listLoyaltyActivity } from "@/services/loyalty-activity.service";
export const metadata = { title: "StayElite Activity | Homyz" };
export default async function LoyaltyActivityPage() { const user = await requirePageUser(); const feed = await listLoyaltyActivity(user.id); return <LoyaltyActivityFeed initialItems={feed.items} initialTotal={feed.total} />; }
