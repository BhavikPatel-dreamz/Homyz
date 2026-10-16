import { HostMessagesSkeleton } from "@/components/messages/message-workspace-skeleton";

export default function HostMessagesLoading() {
  return <div className="flex min-h-screen flex-col bg-zinc-50/50"><HostMessagesSkeleton /></div>;
}
