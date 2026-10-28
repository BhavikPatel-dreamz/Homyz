# Public user profile audit and fix

## Scope

Audited `/users/profile/[id]` and its review detail route against the stored `User`, `Listing`, `Review`, and `TravelProfile` records. The public route is now role-aware: a `HOST` receives host-specific reputation and public inventory; a `USER` receives a guest identity and published feedback received from hosts.

## Findings and fixes

- The loader previously treated every ID as a host, without checking account status or the profile-visibility preference. It now rejects missing, suspended, pending, and hidden profiles with the existing not-found fallback.
- The old response forwarded the entire JSON `publicProfile` object to the browser. It now serializes only explicitly public, rendered values: bio, public location, work, education, languages, interests, and supported profile prompts/facts. Email, phone, birth date, documents, private addresses, and arbitrary JSON keys are never selected or returned.
- Host listing totals were capped at the first twelve cards. The UI still deliberately loads the latest twelve cards for page weight, while `listingCount` now comes from a matching database count and accurately reflects all active public listings.
- Host reviews continue to use only published guest-to-property reviews on active, public listings. Published host-to-guest reviews are provided separately for guest profiles and do not disclose listing data.
- Superhost display continues to use the existing qualification service and persisted eligibility; it is not recomputed or inferred from page content.
- A Travel Profile link is supplied only when its visibility is `PUBLIC`, and links to the existing `/travelers/[publicId]` route. Private and followers-only identifiers are not sent to this UI.
- The shared identity card now labels the user as Host or Guest, avoids a star beside an absent rating, and supports the correct tenure label. Empty optional biography/review/listing sections use compact, truthful states rather than placeholder content.
- The host-only review detail page rejects non-host users, preventing a guest profile from being presented as a host review page.

## Validation

- `npx tsc --noEmit --pretty false`
- `npx tsx --test __tests__/public-user-profile-audit.test.ts`
- Read-only production-shaped record checks through `userService.getPublicHostProfile` for an active host with public travel identity, an active guest with a private travel profile, and a host with active listings. The private Travel Profile identifier was omitted as expected.

## Constraints retained

- Existing profile-management forms, travel-profile access rules, review eligibility, booking flows, listing qualification, and Superhost qualification were not changed.
- Public listing cards remain limited to twelve on the profile page to bound initial rendering cost; the displayed count reports the real total.
