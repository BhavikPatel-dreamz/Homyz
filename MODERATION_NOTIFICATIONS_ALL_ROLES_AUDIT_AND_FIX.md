# Moderation notifications: all-roles audit and fix

## Scope

Focused audit of the existing in-app `Notification` model and `notificationService`. No second notification system, notification model, queue, or unrelated booking/payment notification was added.

| Event | Admin | Host | Guest | Before | After | Status |
|---|---|---|---|---|---|---|
| Report submitted | Central case queue; high-priority triage alert where configured | Modal confirmation and My Reports | Modal confirmation and My Reports | Already confidential; no allegation alert to content owner | Preserved | Verified |
| Case assigned | Assignee/replaced assignee | — | — | Helpers existed but were never invoked | Post-commit assignment/reassignment notifications now dispatch | Fixed |
| Case under review | Case status/UI | — | — | No external disclosure | Preserved; assigned moderator gets follow-up alert when applicable | Verified |
| Information requested | Request activity and assignee alert | Selected recipient | Selected recipient | Host link incorrectly opened dispute resolution center | Recipient gets canonical authorized Reports link with request ID; assignee is alerted | Fixed |
| Evidence submitted | Assigned moderator | Submitter receipt | Submitter receipt | Standalone participant evidence did not alert assignee | Safe evidence alert plus receipt; RFI evidence is coalesced into response notification | Fixed |
| Review removed | Case/audit activity | Actual review author; reporter outcome | Actual review author; reporter outcome | Correct author lookup existed after prior fix; review link was unavailable | Uses actual `authorId`, canonical participant link, and outcome notifications | Fixed |
| Listing restricted | Case/audit activity | Listing owner | — | Existing implementation | Preserved | Verified |
| Media removed | Case/audit activity | Listing owner | Profile owner where applicable | Existing implementation | Preserved; report links canonicalized | Verified |
| Message moderated | Case/audit activity | Actual message author/reporter | Actual message author/reporter | Author notified; reporters did not receive permitted outcome | Sender and distinct reporters now receive safe, separate outcomes | Fixed |
| User warning | Case/audit activity | Affected account | Affected account | Existing implementation | Preserved | Verified |
| Account suspended | Case/audit activity | Affected account | Affected account | Existing implementation | Preserved | Verified |
| Restriction expired | System activity/audit | Affected account | Affected account | Existing implementation | Preserved | Verified |
| Appeal submitted | Assigned reviewer | Appellant receipt | Appellant receipt | Assigned reviewer notified; appellant had only API/modal acknowledgement | Appellant receipt notification added; no self-notification to an appellant who is the assigned staff member | Fixed |
| Appeal approved | Case/audit activity | Appellant | Appellant | Existing notification had generic link | Direct link now includes canonical case/appeal context | Fixed |
| Appeal rejected | Case/audit activity | Appellant | Appellant | Existing notification had generic link | Direct link now includes canonical case/appeal context | Fixed |
| Content restored | Case/audit activity | Actual owner/reporter where relevant | Actual owner/reporter where relevant | Review/message restoration lacked complete notices | Safe restoration outcomes added for review and message flows | Fixed |
| Case resolved | Case/audit activity | Reporter outcome where allowed | Reporter outcome where allowed | Existing implementation | Canonical Reports links used | Verified |
| Case reopened | Case/audit activity | — | — | Existing status/audit activity | Preserved; no unnecessary allegation notice | Verified |

## Changes made

- Reused `notificationService.create`, its per-user/entity/event idempotency logic, unread-cache invalidation, and existing notification API/UI.
- Added `moderationParticipantLink` in `services/moderation.service.ts` so participant notifications cannot lead to admin-only case pages or the unrelated host dispute center.
- Activated post-commit case-assignment and assignee-follow-up notification paths.
- Added safe moderation notifications for standalone participant evidence, information-request responses, appeal submission receipts, review/message restoration, and message-report outcomes.
- Ensured message reporters are deduplicated and the message author does not receive a redundant reporter outcome.
- Corrected the RFI UI field from `questions` to the API-provided `requestText`.

## Recipient and privacy controls verified

- New reports do not notify the reported user or expose reporter identity.
- Review enforcement resolves the actual review `authorId`; it does not infer author from listing ownership or review direction.
- Information-request recipients are resolved from authorized case participants.
- Participant links use `/profile/reports?caseId=…`; staff links remain `/admin/moderation/cases/[id]` or the existing appeals queue.
- Notification metadata contains record IDs and workflow context only; private evidence storage paths and message bodies are not included.
- All new notifications are created only after the corresponding business record/activity has been written successfully.

## Files modified

- `services/moderation.service.ts`
- `components/profile/my-reports-view.tsx`
- `__tests__/moderation-notifications-all-roles.test.ts`

## Verification executed

- `npx tsc --noEmit --pretty false` — passed.
- `node --import tsx --test __tests__/moderation-notifications-all-roles.test.ts __tests__/phase4-review-reports-and-disputes.test.ts` — 12/12 subtests passed.
- `npx prisma validate` — passed.

## Remaining blockers

- No external push/email/SMS notification provider is configured for these in-app moderation notices, so provider delivery/retry E2E cannot be exercised. Database notification creation failures are logged by the existing service; the existing durable job handler remains available for queued delivery where used.
- Full browser/database role E2E was not run because the current repository test setup does not provide isolated seeded accounts in this task. Focused TypeScript, Prisma, and notification-flow regression coverage was executed.
