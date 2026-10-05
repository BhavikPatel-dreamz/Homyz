import { YourSpaceEditorSkeleton } from "../components/YourSpaceSkeletons";

export default function HostListingSectionLoading() {
  // `loading.tsx` is rendered as a Suspense fallback and receives no route
  // params. Use the editor's representative first-section layout so the page
  // shell stays stable while the selected section streams in.
  return <YourSpaceEditorSkeleton section="property-type" />;
}
