import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { guidebookService } from "@/services/guidebook.service";
import { GuestGuidebookClient } from "./guest-guidebook-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuidebookPage({ params }: PageProps) {
  const { id } = await params;
  const actor = await getSessionUser();

  try {
    const guidebook = await guidebookService.getPublicGuidebook(id, actor?.id);
    return <GuestGuidebookClient guidebook={guidebook} viewerId={actor?.id} />;
  } catch (err) {
    notFound();
  }
}
