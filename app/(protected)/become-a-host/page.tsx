import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";

export default async function BecomeAHostPage() {
  const user = await requirePageUser("/become-a-host");

  if (user.role === Role.HOST || user.role === Role.ADMIN) {
    redirect("/host/listings/new?type=HOME");
  }

  redirect("/host/onboarding");
}
