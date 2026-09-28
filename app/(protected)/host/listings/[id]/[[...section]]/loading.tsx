import { YourSpaceEditorSkeleton } from "../components/YourSpaceSkeletons";

interface LoadingProps {
  params?: Promise<{ id?: string; section?: string[] }>;
  searchParams?: Promise<{ section?: string }>;
}

export default async function HostListingSectionLoading({ params, searchParams }: LoadingProps) {
  const resolvedParams = params ? await params : undefined;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const rawSection = resolvedParams?.section?.[0] || resolvedSearchParams?.section || "property-type";

  return <YourSpaceEditorSkeleton section={rawSection} />;
}
