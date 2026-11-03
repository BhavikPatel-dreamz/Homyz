# StayElite requirement coverage matrix

Status counts exclude requirements blocked by an unresolved policy or environment. Of 30 tier/badge/sticker definitions: 3 calculations are implemented and verified but inactive; 8 city calculations are partially implemented; 19 remaining definitions are policy-blocked from award activation. `PV` means deterministic calculation/projection test, not an issued award.

| ID | Source | Requirement / implementation | Status | Evidence / activation |
|---|---|---|---|---|
| T1 | 01 §4, 03 | Traveler: `stayelite-tier.service.ts` | IMPLEMENTED_VERIFIED | Phase 5 test; promotion disabled |
| T2 | 01 §4, 03 | Ambassador: 15 stays, ratings, 5 referrals | IMPLEMENTED_VERIFIED | Phase 5 test; blocked DEC-001/004/007/008 |
| T3 | 01 §4, 03 | Icon: 25 stays, ratings, 10 referrals | IMPLEMENTED_VERIFIED | Phase 5 test; blocked DEC-001/004/007/008 |
| C1–C8 | 01 §6, 02 | Paris, London, New York, Riyadh/Dubai, Tokyo, Miami, San Francisco, Venice; destination service | PARTIALLY_IMPLEMENTED | Phase 3 alias/catalog tests; no award activation pending DEC-001/002 |
| G1 | 01 §7 | Beach Bum taxonomy calculation | BLOCKED_BY_POLICY | Phase 3 PV; DEC-014 |
| G2 | 01 §7 | Mountain Mover taxonomy calculation | BLOCKED_BY_POLICY | Phase 3 PV; DEC-014 |
| G3 | 01 §7 | City Lights distinct-city calculation | BLOCKED_BY_POLICY | Phase 3 PV; DEC-014 |
| G4 | 01 §7 | Nature Nomad taxonomy calculation | BLOCKED_BY_POLICY | Phase 3 PV; DEC-014 |
| G5 | 01 §7 | Cultural Explorer taxonomy calculation | BLOCKED_BY_POLICY | Phase 3 PV; DEC-014 |
| G6 | 01 §7 | Continent Collector | BLOCKED_BY_POLICY | no threshold; DEC-014 |
| Q1 | 01 §5, 04 | Zero-Cancel Pro / 300 points | PARTIALLY_IMPLEMENTED | calculation and ledger foundation; DEC-003 blocks award/issuance |
| Q2 | 01 §5 | 5-Star Streak | BLOCKED_BY_POLICY | Phase 4 PV; DEC-004/006/009 |
| Q3 | 01 §5 | Super Reviewer | BLOCKED_BY_POLICY | Phase 4 PV; DEC-005 |
| Q4 | 01 §5 | City Collector | BLOCKED_BY_POLICY | Phase 4 PV; fulfilment DEC-012 |
| Q5 | 01 §5 | Loyal Nomad | BLOCKED_BY_POLICY | Phase 4 PV; DEC-006/012 |
| B1 | 01 §8 | Early Bird (>=30 days) | BLOCKED_BY_POLICY | Phase 4 boundary test; completion policy |
| B2 | 01 §8 | Last Minute Luck (<=12 hours) | BLOCKED_BY_POLICY | Phase 4 boundary test; completion policy |
| B3 | 01 §8 | Loyal Wanderer (3 listing stays) | BLOCKED_BY_POLICY | Phase 4 PV; completion policy |
| B4 | 01 §8 | Season Hopper | BLOCKED_BY_POLICY | DEC-013 |
| B5 | 01 §8 | Group Pack (>=4 guests) | BLOCKED_BY_POLICY | Phase 4 boundary test; completion policy |
| B6 | 01 §8 | Perfect Guest (10 hosts) | BLOCKED_BY_POLICY | Phase 4 distinct-host test; rating policy |
| B7 | 01 §8 | 10-Stay Veteran | BLOCKED_BY_POLICY | Phase 4 PV; completion policy |
| B8 | 01 §8 | Language Leaper | BLOCKED_BY_POLICY | DEC-015 |
| PTS-01 | 04 §1 | Account, immutable ledger, balances, idempotency | IMPLEMENTED_UNVERIFIED | new schema/service/migration and Phase 6 unit test; DB migration required |
| RWD-01 | 04 §4 | Catalog and reserve/commit/release lifecycle | PARTIALLY_IMPLEMENTED | inactive service; policy, migration, concurrency, fulfilment blocked |
| CMP-01 | 05 §1 | Campaign configuration lifecycle | PARTIALLY_IMPLEMENTED | draft schema only; no active pricing/award execution |
| SEC-01 | 13 | secret fallback and database-test isolation | IMPLEMENTED_VERIFIED | Phase 13 regression test |

The 30-definition denominator is `T1–T3 + C1–C8 + G1–G6 + Q1–Q5 + B1–B8 = 30`. Only the three tier calculations are verified calculations (10%); none is verified for production activation. The broader platform entries are not included in that percentage.
