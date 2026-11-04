"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { HostListingEditorClient } from "./host-listing-editor-client";
import { slugToSection, type HostListingData } from "./section-helpers";

/**
 * The editor belongs to the `[id]` layout, not an individual settings page.
 * Reading the active catch-all segment here keeps the route URL and the
 * persistent client workspace in sync without remounting its sidebar.
 */
export function ListingEditorRouteWorkspace({
  listing,
  initialGuidebooks,
}: {
  listing: HostListingData;
  initialGuidebooks: unknown[];
}) {
  const segments = useSelectedLayoutSegments();
  const activeRouteSegment = segments.at(-1)?.split("/")[0];

  return (
    <HostListingEditorClient
      listing={listing}
      initialSection={slugToSection(activeRouteSegment)}
      initialGuidebooks={initialGuidebooks}
    />
  );
}
