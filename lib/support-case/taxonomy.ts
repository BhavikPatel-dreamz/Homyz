/**
 * Guest-facing support taxonomy. The API, rather than the client, is the
 * source of truth so a submitted category cannot be forged from the browser.
 *
 * These values are deliberately separate from legacy ListingQualityIncident
 * categories. Legacy incidents continue to use their existing workflow.
 */
export const GUEST_SUPPORT_TAXONOMY = [
  {
    value: "BOOKING",
    label: "Booking and reservation",
    issueTypes: [
      { value: "CHECK_IN", label: "Check-in or access" },
      { value: "CHANGE_REQUEST", label: "Change a reservation" },
      { value: "CANCELLATION", label: "Cancellation" },
      { value: "HOST_COMMUNICATION", label: "Host communication" },
      { value: "PROPERTY_ISSUE", label: "Issue with the property" },
    ],
  },
  {
    value: "PAYMENT",
    label: "Payment and receipt",
    issueTypes: [
      { value: "PAYMENT_PROBLEM", label: "Payment problem" },
      { value: "RECEIPT", label: "Receipt or invoice" },
      { value: "REFUND_QUESTION", label: "Refund question" },
    ],
  },
  {
    value: "ACCOUNT",
    label: "Account and profile",
    issueTypes: [
      { value: "ACCOUNT_ACCESS", label: "Account access" },
      { value: "PROFILE", label: "Profile or verification" },
    ],
  },
  {
    value: "SAFETY",
    label: "Safety concern",
    issueTypes: [
      { value: "SAFETY_CONCERN", label: "Safety concern" },
      { value: "ACCESSIBILITY", label: "Accessibility concern" },
    ],
  },
  {
    value: "OTHER",
    label: "Other",
    issueTypes: [{ value: "OTHER", label: "Other support request" }],
  },
] as const;

export type GuestSupportCategory = (typeof GUEST_SUPPORT_TAXONOMY)[number]["value"];

export function isSupportedGuestSupportRequest(category: string, issueType?: string): boolean {
  const selected = GUEST_SUPPORT_TAXONOMY.find((item) => item.value === category);
  if (!selected) return false;
  return !issueType || selected.issueTypes.some((item) => item.value === issueType);
}
