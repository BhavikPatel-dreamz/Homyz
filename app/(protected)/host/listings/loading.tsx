import { HostListingsSkeleton } from "@/components/host/host-listings-skeleton";

export default function HostListingsLoading() {
  return <HostListingsSkeleton cardCount={12} />;
}
