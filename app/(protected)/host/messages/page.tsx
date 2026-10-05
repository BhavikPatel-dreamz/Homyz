import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { MessagesHeader } from "@/components/host/messages/messages-header";
import { Footer } from "@/components/dashboard/footer";
import { HostMessagesWorkspace } from "@/components/host/messages/host-messages-workspace";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";

export default async function HostMessagesPage(props: {
  searchParams?: Promise<{ id?: string }> | { id?: string };
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedParams = await Promise.resolve(props.searchParams);
  const initialConversationId = resolvedParams?.id;
  const initialData = await messagingService.listConversationsForUser(actor, {
    role: "host",
    take: 50,
  });
  const initialRenderedAt = new Date().toISOString();

  return (
    <div className="min-h-screen sm:pb-0 bg-zinc-50/50 text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B] selection:text-[#1F1F1F]">
      {/* Messages has a dedicated workspace header. */}
      <MessagesHeader />

      <main className="flex-1 flex flex-col">
        <HostMessagesWorkspace
          initialConversationId={initialConversationId}
          initialConversations={initialData.conversations}
          initialRenderedAt={initialRenderedAt}
        />
      </main>

      {/* <Footer /> */}
    </div>
  );
}
