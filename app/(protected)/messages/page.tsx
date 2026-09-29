import { requirePageUser } from "@/lib/permissions/page-guards";
import { GuestMessagesWorkspace } from "@/components/messages/guest-messages-workspace";

export const dynamic = "force-dynamic";

export default async function GuestMessagesPage(props: {
  searchParams?: Promise<{ id?: string }> | { id?: string };
}) {
  await requirePageUser();
  const resolvedParams = await Promise.resolve(props.searchParams);
  const initialConversationId = resolvedParams?.id;

  return <GuestMessagesWorkspace initialConversationId={initialConversationId} />;
}

