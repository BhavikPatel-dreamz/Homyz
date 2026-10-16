import { NewListingWizardSkeleton } from "@/components/host/new-listing-wizard-skeleton";

export default function NewListingLoading() {
  // Route loading UI has no access to search params. The overview is the
  // wizard's entry layout and preserves its header, content width and footer.
  return <NewListingWizardSkeleton step="overview" />;
}
