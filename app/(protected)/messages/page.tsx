import { requirePageUser } from "@/lib/permissions/page-guards";
import { GuestMessagesWorkspace } from "@/components/messages/guest-messages-workspace";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";

export default async function GuestMessagesPage(props: {
  searchParams?: Promise<{ id?: string }> | { id?: string };
}) {
  const actor = await requirePageUser();
  const resolvedParams = await Promise.resolve(props.searchParams);
  const initialConversationId = resolvedParams?.id;
  const initialData = await messagingService.listConversationsForUser(actor, {
    role: "guest",
    take: 50,
  });
  const initialRenderedAt = new Date().toISOString();

  return (
    <GuestMessagesWorkspace
      initialConversationId={initialConversationId}
      initialConversations={initialData.conversations}
      initialRenderedAt={initialRenderedAt}
    />
  );
}
