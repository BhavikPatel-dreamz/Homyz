"use client";

import { usePathname } from "next/navigation";
import { YourSpaceEditorSkeleton } from "./components/YourSpaceSkeletons";
import { slugToSection } from "./section-helpers";

export default function HostListingLoading() {
  const pathname = usePathname() || "";
  const match = pathname.match(/\/host\/listings\/[^/]+\/([^/?#]+)/);
  const section = match?.[1] ? slugToSection(match[1]) : "propertyType";

  return <YourSpaceEditorSkeleton section={section} />;
}
