import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostMessagesWorkspace } from "@/components/host/messages/host-messages-workspace";
import {
  messagingService,
  type MessageDTO,
  type ConversationDTO,
} from "@/services/messaging.service";

export const dynamic = "force-dynamic";

export default async function HostMessagesPage(props: {
  searchParams?: Promise<{ id?: string }> | { id?: string };
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedParams = await Promise.resolve(props.searchParams);
  const initialConversationId = resolvedParams?.id;
  const initialData = await messagingService.listConversationsForUser(actor, {
    role: "host",
    take: 25,
  });
  const initialRenderedAt = new Date().toISOString();

  const activeId = initialConversationId ?? initialData.conversations[0]?.id;
  let initialMessages: MessageDTO[] = [];
  let initialConversationDetail: ConversationDTO | null = null;
  let initialNextCursor: string | null = null;
  let initialHasMore = false;

  if (activeId) {
    try {
      const [messagesResult, detailResult] = await Promise.all([
        messagingService.getConversationMessages(actor, activeId, {
          take: 40,
          includeTotal: false,
        }),
        messagingService.getConversationById(actor, activeId),
      ]);
      initialMessages = messagesResult.messages;
      initialNextCursor = messagesResult.nextCursor;
      initialHasMore = messagesResult.hasMore;
      initialConversationDetail = detailResult;
    } catch {
      // Graceful fallback to client-side fetch if any issue
    }
  }

  return (
    <div className="min-h-screen sm:pb-0 bg-zinc-50/50 text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FCDF9C] selection:text-[#1F1F1F]">
      <HostHeader />

      <main className="flex min-w-0 flex-1 flex-col pt-3">
        <HostMessagesWorkspace
          initialConversationId={initialConversationId}
          initialConversations={initialData.conversations}
          initialConversationTotal={initialData.total}
          initialRenderedAt={initialRenderedAt}
          initialMessages={initialMessages}
          initialNextCursor={initialNextCursor}
          initialHasMore={initialHasMore}
          initialConversationDetail={initialConversationDetail}
        />
      </main>
    </div>
  );
}
