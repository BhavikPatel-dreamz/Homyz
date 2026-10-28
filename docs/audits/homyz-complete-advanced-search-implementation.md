# HOMYZ advanced search audit

| Feature | Status | Files Changed | Verification |
|---|---|---|---|
| Search bar | Existing shared home/results variants | — | Source audit |
| Location autocomplete | Existing: debounced, cancellable suggestions, keyboard support, nearby flow | — | Source audit |
| Recent searches | Existing browser-local and persisted-context support | — | Source audit |
| Suggested destinations | Existing search-suggest endpoint integration | — | Source audit |
| Nearby search | Existing user-initiated geolocation with fallback/error state | — | Source audit |
| Two-month date picker | Existing | — | Source audit |
| Date flexibility chips | Fixed: restored ±14-day choice | `mobile-date-picker.tsx` | TypeScript/lint |
| Flexible weekend/week/month | UI tabs restored and URL state serialized | `mobile-date-picker.tsx`, `home-view.tsx` | TypeScript/lint |
| Travel-month carousel | Fixed: cards now begin with the current month and advance across years | `mobile-date-picker.tsx` | TypeScript/lint |
| Adults/children/infants/pets | Existing four-category selector; removed implicit homepage one-guest URL filter | `home-view.tsx` | TypeScript/lint |
| Independent optional filters | Existing popup state with click-outside/Escape handling | — | Source audit |
| Search results integration | Exact-date availability path exists; flexible parameters require backend support before being applied as availability filters | — | Source audit |
| Availability correctness | Exact dates use booking/blocked-date and host-rule validation | — | Source audit |
| URL synchronization | Fixed home serialization of `dateMode`, `stay`, `months`, and `dateFlex` | `home-view.tsx` | TypeScript/lint |
| Mobile experience | Existing modal flow and picker | — | Source audit |
| Performance | Existing autocomplete debounce/cancellation and listing cache | — | Source audit |
| End-to-end tests | Not available: no browser/E2E runner configured | — | N/A |

## Important limitation

The listing search API currently accepts only an exact `checkIn`/`checkOut` availability range. It does not yet contain a non-arbitrary flexible-month/date-tolerance availability algorithm. No such filter was fabricated in this change; implementing it requires a bounded candidate-date strategy agreed with product and exercised against booking/blocked-date rules.
