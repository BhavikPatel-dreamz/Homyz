import { NewListingWizardSkeleton } from "@/components/host/new-listing-wizard-skeleton";

interface LoadingProps {
  searchParams?: Promise<{ step?: string | string[] }>;
}

export default async function NewListingLoading({ searchParams }: LoadingProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawStep = Array.isArray(resolvedSearchParams?.step)
    ? resolvedSearchParams.step[0]
    : resolvedSearchParams?.step || "overview";

  return <NewListingWizardSkeleton step={rawStep} />;
}
