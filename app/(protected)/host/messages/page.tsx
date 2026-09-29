import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";
import { HostMessagesWorkspace } from "@/components/host/messages/host-messages-workspace";

export const dynamic = "force-dynamic";

export default async function HostMessagesPage(props: {
  searchParams?: Promise<{ id?: string }> | { id?: string };
}) {
  await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedParams = await Promise.resolve(props.searchParams);
  const initialConversationId = resolvedParams?.id;

  return (
    <div className="min-h-screen pb-[calc(110px+env(safe-area-inset-bottom))] sm:pb-0 bg-zinc-50/50 text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B] selection:text-[#1F1F1F]">
      {/* TOP HEADER */}
      <HostHeader />

      {/* TOP NAV TABS */}
      <HostSubNav activeTab="messages" />

      <main className="flex-1 flex flex-col">
        <HostMessagesWorkspace initialConversationId={initialConversationId} />
      </main>

      <Footer />
    </div>
  );
}
