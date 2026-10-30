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

/**
 * Host-facing support taxonomy. Allows hosts to submit eligible requests for
 * reservations, guest concerns, listings, payouts, accounts, or technical help.
 */
export const HOST_SUPPORT_TAXONOMY = [
  {
    value: "RESERVATION",
    label: "Reservation and booking",
    issueTypes: [
      { value: "CHECK_IN_COORDINATION", label: "Check-in or access coordination" },
      { value: "MODIFICATION_REQUEST", label: "Reservation change or extension" },
      { value: "CANCELLATION_INQUIRY", label: "Cancellation inquiry" },
      { value: "GUEST_COMMUNICATION", label: "Guest communication assistance" },
    ],
  },
  {
    value: "GUEST_CONCERN",
    label: "Guest-related concern",
    issueTypes: [
      { value: "HOUSE_RULES_VIOLATION", label: "House rules violation" },
      { value: "DAMAGE_INQUIRY", label: "Property damage inquiry" },
      { value: "EXTRA_GUESTS_OR_PETS", label: "Unregistered guests or pets" },
      { value: "EARLY_LATE_CHECKOUT", label: "Unauthorized late check-out" },
    ],
  },
  {
    value: "LISTING",
    label: "Listing and property",
    issueTypes: [
      { value: "CALENDAR_OR_PRICING", label: "Calendar or pricing setup" },
      { value: "LISTING_DETAILS", label: "Listing content or photos" },
      { value: "AVAILABILITY_SETTINGS", label: "Availability or minimum stay settings" },
    ],
  },
  {
    value: "PAYOUT_QUESTION",
    label: "Payout and financial question",
    issueTypes: [
      { value: "PAYOUT_STATUS", label: "Payout timeline or status inquiry" },
      { value: "BANK_ACCOUNT_METHOD", label: "Bank account or payout method question" },
      { value: "TAX_DOCUMENT_INQUIRY", label: "Tax document inquiry" },
    ],
  },
  {
    value: "ACCOUNT",
    label: "Host account and profile",
    issueTypes: [
      { value: "HOST_VERIFICATION", label: "Host identity or verification" },
      { value: "COHOST_MANAGEMENT", label: "Co-host management" },
      { value: "NOTIFICATION_SETTINGS", label: "Notification preferences" },
    ],
  },
  {
    value: "TECHNICAL",
    label: "Technical support",
    issueTypes: [
      { value: "APP_ISSUE", label: "App or website technical issue" },
      { value: "SYNC_CALENDAR", label: "iCal calendar synchronization" },
    ],
  },
  {
    value: "OTHER",
    label: "Other hosting assistance",
    issueTypes: [{ value: "GENERAL_HOSTING", label: "General hosting assistance" }],
  },
] as const;

export type HostSupportCategory = (typeof HOST_SUPPORT_TAXONOMY)[number]["value"];

export function isSupportedHostSupportRequest(category: string, issueType?: string): boolean {
  const selected = HOST_SUPPORT_TAXONOMY.find((item) => item.value === category);
  if (!selected) return false;
  return !issueType || selected.issueTypes.some((item) => item.value === issueType);
}

export function isSupportedSupportRequest(category: string, issueType?: string): boolean {
  return isSupportedGuestSupportRequest(category, issueType) || isSupportedHostSupportRequest(category, issueType);
}
