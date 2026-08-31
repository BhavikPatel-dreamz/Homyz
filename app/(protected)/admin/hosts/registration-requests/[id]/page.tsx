import { redirect } from "next/navigation";

interface LegacyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyRegistrationRequestDetailPage({ params }: LegacyDetailPageProps) {
  const { id } = await params;
  redirect(`/admin/hosts/onboarding/registration-requests/${id}`);
}
