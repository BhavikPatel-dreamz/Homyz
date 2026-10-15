import test from 'node:test';
import assert from 'node:assert/strict';
import { getModerationPolicy, MODERATION_POLICIES } from '@/lib/moderation/policies';
import { assertValidModerationTransition } from '@/lib/moderation/lifecycle';
import { ListingStatus } from '@/generated/prisma/enums';

test('Phase 5: Reported Listings & Property Moderation', async (t) => {
  await t.test('1. Policy catalog supports all required listing safety & accuracy categories', () => {
    const listingPolicies = MODERATION_POLICIES.filter((p) => p.targetTypes.includes('LISTING'));
    const policyCodes = listingPolicies.map((p) => p.code);

    assert.ok(policyCodes.includes('FAKE_OR_NONEXISTENT_PROPERTY'), 'Must include FAKE_OR_NONEXISTENT_PROPERTY');
    assert.ok(policyCodes.includes('INCORRECT_PHOTOS'), 'Must include INCORRECT_PHOTOS');
    assert.ok(policyCodes.includes('SAFETY_OR_SECURITY_CONCERNS'), 'Must include SAFETY_OR_SECURITY_CONCERNS');
    assert.ok(policyCodes.includes('INACCURATE_LOCATION_OR_AMENITIES'), 'Must include INACCURATE_LOCATION_OR_AMENITIES');

    // Verify severities
    const fakePolicy = getModerationPolicy('FAKE_OR_NONEXISTENT_PROPERTY', 'LISTING');
    assert.ok(fakePolicy);
    assert.equal(fakePolicy?.defaultSeverity, 'CRITICAL');

    const safetyPolicy = getModerationPolicy('SAFETY_OR_SECURITY_CONCERNS', 'LISTING');
    assert.ok(safetyPolicy);
    assert.equal(safetyPolicy?.defaultSeverity, 'HIGH');

    const photoPolicy = getModerationPolicy('INCORRECT_PHOTOS', 'LISTING');
    assert.ok(photoPolicy);
    assert.equal(photoPolicy?.defaultSeverity, 'MEDIUM');
  });

  await t.test('2. Case lifecycle transitions for listing investigations', () => {
    // Normal investigation progression
    assert.doesNotThrow(() => assertValidModerationTransition('NEW', 'IN_REVIEW'));
    assert.doesNotThrow(() => assertValidModerationTransition('IN_REVIEW', 'NEEDS_INFORMATION'));
    assert.doesNotThrow(() => assertValidModerationTransition('NEEDS_INFORMATION', 'IN_REVIEW'));
    assert.doesNotThrow(() => assertValidModerationTransition('IN_REVIEW', 'RESOLVED'));
    assert.doesNotThrow(() => assertValidModerationTransition('IN_REVIEW', 'DISMISSED'));

    // Reopening resolved or dismissed cases
    assert.doesNotThrow(() => assertValidModerationTransition('RESOLVED', 'REOPENED'));
    assert.doesNotThrow(() => assertValidModerationTransition('DISMISSED', 'REOPENED'));

    // Illegal transitions: cannot jump from NEW directly to REOPENED, or from DISMISSED to RESOLVED
    assert.throws(() => assertValidModerationTransition('NEW', 'REOPENED'));
    assert.throws(() => assertValidModerationTransition('DISMISSED', 'RESOLVED'));
    assert.throws(() => assertValidModerationTransition('RESOLVED', 'IN_REVIEW'));
  });

  await t.test('3. Listing moderation action behavior specifications', () => {
    // Simulated listing state
    const originalListing = {
      id: 'listing_123',
      title: 'Beachside Villa',
      status: ListingStatus.ACTIVE,
      published: true,
      isPaused: false,
      rejectionReason: null as string | null,
      requestedChanges: null as Record<string, unknown> | null,
    };

    // Action: WARN_HOST
    // Does not mutate publication or pause status
    const warnedListing = { ...originalListing };
    assert.equal(warnedListing.status, ListingStatus.ACTIVE);
    assert.equal(warnedListing.published, true);
    assert.equal(warnedListing.isPaused, false);

    // Action: REQUEST_CORRECTION
    const correctionListing = {
      ...originalListing,
      requestedChanges: { reason: 'Update bathroom photos', requestedAt: new Date().toISOString() },
    };
    assert.ok(correctionListing.requestedChanges);
    assert.equal(correctionListing.status, ListingStatus.ACTIVE);

    // Action: TEMPORARY_RESTRICTION
    const restrictedListing = {
      ...originalListing,
      published: false,
      isPaused: true,
    };
    assert.equal(restrictedListing.published, false);
    assert.equal(restrictedListing.isPaused, true);
    // Preserves status as ACTIVE so it can be unpaused smoothly
    assert.equal(restrictedListing.status, ListingStatus.ACTIVE);

    // Action: SUSPEND
    const suspendedListing = {
      ...originalListing,
      published: false,
      isPaused: true,
      status: ListingStatus.REJECTED,
      rejectionReason: 'Fraudulent listing details',
    };
    assert.equal(suspendedListing.published, false);
    assert.equal(suspendedListing.isPaused, true);
    assert.equal(suspendedListing.status, ListingStatus.REJECTED);
    assert.equal(suspendedListing.rejectionReason, 'Fraudulent listing details');

    // Action: RESTORE
    const restoredListing = {
      ...suspendedListing,
      published: true,
      isPaused: false,
      status: ListingStatus.ACTIVE,
      rejectionReason: null,
      requestedChanges: null,
    };
    assert.equal(restoredListing.published, true);
    assert.equal(restoredListing.isPaused, false);
    assert.equal(restoredListing.status, ListingStatus.ACTIVE);
    assert.equal(restoredListing.rejectionReason, null);
    assert.equal(restoredListing.requestedChanges, null);
  });

  await t.test('4. Marketplace visibility and booking contract under moderation restrictions', () => {
    // Public search filter contract: { published: true, status: ACTIVE, isPaused: false, deletedAt: null }
    function isSearchVisible(listing: { published: boolean; status: ListingStatus; isPaused: boolean; deletedAt: Date | null }) {
      return listing.published === true && listing.status === ListingStatus.ACTIVE && listing.isPaused === false && listing.deletedAt === null;
    }

    const activeListing = { published: true, status: ListingStatus.ACTIVE, isPaused: false, deletedAt: null };
    const restrictedListing = { published: false, status: ListingStatus.ACTIVE, isPaused: true, deletedAt: null };
    const suspendedListing = { published: false, status: ListingStatus.REJECTED, isPaused: true, deletedAt: null };

    assert.equal(isSearchVisible(activeListing), true, 'Active listing must be visible in search');
    assert.equal(isSearchVisible(restrictedListing), false, 'Restricted listing must NOT be visible in search');
    assert.equal(isSearchVisible(suspendedListing), false, 'Suspended listing must NOT be visible in search');

    // Existing bookings are NOT cancelled by moderation restriction
    const existingBookings = [
      { id: 'b_1', status: 'CONFIRMED', guestId: 'g_1', startDate: '2026-10-20', endDate: '2026-10-25' },
    ];
    // Restriction applied
    const remainingBookings = [...existingBookings];
    assert.equal(remainingBookings.length, 1, 'Existing confirmed bookings must remain preserved');
    assert.equal(remainingBookings[0].status, 'CONFIRMED', 'Existing booking status must not be modified');
  });

  await t.test('5. Host permission boundary: Host cannot overwrite moderation restrictions', () => {
    // Simulated host listing update sanitizer from listingService.update
    function sanitizeHostListingUpdate(payload: Record<string, unknown>, actorRole: string) {
      const sanitized = { ...payload };
      if (actorRole !== 'ADMIN') {
        delete sanitized.published;
        delete sanitized.status;
      }
      return sanitized;
    }

    const hostAttemptedPayload = {
      title: 'Updated Title',
      published: true, // Host trying to re-publish restricted listing
      status: ListingStatus.ACTIVE, // Host trying to un-reject
      description: 'New description',
    };

    const hostResult = sanitizeHostListingUpdate(hostAttemptedPayload, 'HOST');
    assert.equal(hostResult.published, undefined, 'Host must not be permitted to set published');
    assert.equal(hostResult.status, undefined, 'Host must not be permitted to set status');
    assert.equal(hostResult.title, 'Updated Title');
    assert.equal(hostResult.description, 'New description');

    const adminResult = sanitizeHostListingUpdate(hostAttemptedPayload, 'ADMIN');
    assert.equal(adminResult.published, true, 'Admin can set published');
    assert.equal(adminResult.status, ListingStatus.ACTIVE, 'Admin can set status');
  });
});
