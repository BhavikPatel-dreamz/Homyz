export function shouldDirectToEditorRoute({
  isWizardFlow,
  isExistingListing,
}: {
  isWizardFlow: boolean;
  isExistingListing: boolean;
}) {
  return isExistingListing && !isWizardFlow;
}
