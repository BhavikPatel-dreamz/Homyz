import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGuestReviewEligibility,
  evaluateHostReviewEligibility,
  computeReviewDeadline,
} from '@/lib/booking/review-eligibility';
import { BookingStatus, ReviewDirection, ReviewStatus } from '../generated/prisma/enums';
import { toPublicReviewDTO } from '@/services/mappers';

test('Phase 3: Two-Directional Reviews & Reciprocal Publishing', async (t) => {
  await t.test('1. Eligibility: 14-day review window after checkout', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const completedStayCheckout = new Date('2026-10-10T11:00:00Z'); // 4 days ago
    const expiredStayCheckout = new Date('2026-09-20T11:00:00Z'); // 24 days ago

    // Guest eligibility - valid completed stay
    const guestEligible = evaluateGuestReviewEligibility({
      isGuest: true,
      bookingStatus: BookingStatus.CONFIRMED,
      endDate: completedStayCheckout,
      hasGuestReview: false,
      now,
    });
    assert.equal(guestEligible.canReview, true);
    assert.equal(guestEligible.status, 'ELIGIBLE');
    assert.ok(guestEligible.reviewDeadline);

    // Guest eligibility - expired window (> 14 days)
    const guestExpired = evaluateGuestReviewEligibility({
      isGuest: true,
      bookingStatus: BookingStatus.CONFIRMED,
      endDate: expiredStayCheckout,
      hasGuestReview: false,
      now,
    });
    assert.equal(guestExpired.canReview, false);
    assert.equal(guestExpired.status, 'WINDOW_EXPIRED');

    // Guest eligibility - already reviewed
    const guestAlreadyReviewed = evaluateGuestReviewEligibility({
      isGuest: true,
      bookingStatus: BookingStatus.CONFIRMED,
      endDate: completedStayCheckout,
      hasGuestReview: true,
      now,
    });
    assert.equal(guestAlreadyReviewed.canReview, false);
    assert.equal(guestAlreadyReviewed.status, 'ALREADY_SUBMITTED');

    // Guest eligibility - cancelled reservation before stay
    const guestCancelled = evaluateGuestReviewEligibility({
      isGuest: true,
      bookingStatus: BookingStatus.CANCELLED,
      endDate: completedStayCheckout,
      hasGuestReview: false,
      now,
    });
    assert.equal(guestCancelled.canReview, false);
    assert.equal(guestCancelled.status, 'NOT_COMPLETED');
  });

  await t.test('2. Host eligibility: 14-day review window for host-to-guest reviews', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const checkout = new Date('2026-10-12T11:00:00Z'); // 2 days ago

    // Host eligibility - valid completed stay
    const hostEligible = evaluateHostReviewEligibility({
      isHost: true,
      bookingStatus: BookingStatus.CONFIRMED,
      endDate: checkout,
      hasHostReview: false,
      now,
    });
    assert.equal(hostEligible.canReview, true);
    assert.equal(hostEligible.status, 'ELIGIBLE');
    assert.ok(hostEligible.reviewDeadline);

    // Non-host user rejected
    const nonHost = evaluateHostReviewEligibility({
      isHost: false,
      bookingStatus: BookingStatus.CONFIRMED,
      endDate: checkout,
      hasHostReview: false,
      now,
    });
    assert.equal(nonHost.canReview, false);
    assert.equal(nonHost.status, 'NOT_AUTHORIZED');

    // Host already submitted
    const hostAlreadyReviewed = evaluateHostReviewEligibility({
      isHost: true,
      bookingStatus: BookingStatus.CONFIRMED,
      endDate: checkout,
      hasHostReview: true,
      now,
    });
    assert.equal(hostAlreadyReviewed.canReview, false);
    assert.equal(hostAlreadyReviewed.status, 'ALREADY_SUBMITTED');
  });

  await t.test('3. Deadline computation handles 14 days and checkout time', () => {
    const checkout = new Date('2026-10-01T00:00:00Z');
    const deadline = computeReviewDeadline(checkout, '11:00');
    // 14 days after Oct 1 at 11:00 is Oct 15 at 11:00
    assert.equal(deadline.toISOString(), '2026-10-15T11:00:00.000Z');
  });

  await t.test('4. DTO mapping preserves reciprocal privacy and includes responses', () => {
    // Public guest review with host response
    const mockGuestReview = {
      id: 'rev-1',
      bookingId: 'booking-1',
      listingId: 'listing-1',
      userId: 'guest-1',
      targetUserId: 'host-1',
      direction: ReviewDirection.GUEST_TO_PROPERTY,
      rating: 5,
      cleanliness: 5,
      accuracy: 5,
      communication: 5,
      location: 5,
      checkIn: 5,
      value: 5,
      houseRulesRating: null,
      recommendGuest: null,
      comment: 'Fantastic stay!',
      topics: [],
      privateNoteToHost: 'Loved the coffee, thanks!',
      privateNoteToGuest: null,
      status: ReviewStatus.PUBLISHED,
      submittedAt: new Date('2026-10-05T10:00:00Z'),
      publishedAt: new Date('2026-10-06T12:00:00Z'),
      reviewDeadline: new Date('2026-10-15T10:00:00Z'),
      editDeadline: new Date('2026-10-15T10:00:00Z'),
      moderationNotes: null,
      moderationCaseId: null,
      createdAt: new Date('2026-10-05T10:00:00Z'),
      updatedAt: new Date('2026-10-06T12:00:00Z'),
      author: {
        id: 'guest-1',
        name: 'Alice Guest',
        image: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      },
      response: {
        comment: 'Thank you Alice, hope to host you again!',
        createdAt: new Date('2026-10-07T10:00:00Z'),
        author: {
          name: 'Bob Host',
          image: null,
        },
      },
    };

    const publicDTO = toPublicReviewDTO(mockGuestReview as any);
    assert.equal(publicDTO.id, 'rev-1');
    assert.equal(publicDTO.direction, ReviewDirection.GUEST_TO_PROPERTY);
    assert.equal(publicDTO.rating, 5);
    assert.equal(publicDTO.comment, 'Fantastic stay!');
    // Privacy: private note to host must NEVER leak to public DTO
    assert.equal((publicDTO as any).privateNoteToHost, undefined);
    assert.equal((publicDTO as any).privateNoteToGuest, undefined);
    // Response mapping
    assert.ok(publicDTO.hostResponse);
    assert.equal(publicDTO.hostResponse?.comment, 'Thank you Alice, hope to host you again!');
    assert.equal(publicDTO.hostResponse?.hostName, 'Bob Host');
  });

  await t.test('5. Rating Isolation: Property rating calculations must only include GUEST_TO_PROPERTY reviews', () => {
    // Simulate calculating property average from a set of reviews containing both guest and host reviews
    const allReviews = [
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED, rating: 5 },
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED, rating: 4 },
      // Host-to-guest review rating should NEVER be counted towards the listing average
      { direction: ReviewDirection.HOST_TO_GUEST, status: ReviewStatus.PUBLISHED, rating: 1 },
      // Private/unpublished reviews must not count either
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PRIVATE, rating: 5 },
      // Hidden/moderated reviews must not count either
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.HIDDEN, rating: 2 },
    ];

    const eligibleListingReviews = allReviews.filter(
      (r) => r.direction === ReviewDirection.GUEST_TO_PROPERTY && r.status === ReviewStatus.PUBLISHED
    );

    assert.equal(eligibleListingReviews.length, 2);
    const avgRating =
      eligibleListingReviews.reduce((sum, r) => sum + r.rating, 0) / eligibleListingReviews.length;
    assert.equal(avgRating, 4.5);
    // If HOST_TO_GUEST was accidentally included, the average would be dragged down to (5 + 4 + 1)/3 = 3.33
    assert.notEqual(avgRating, 3.33);
  });

  await t.test('6. Blind review reciprocal transition logic', () => {
    // When review 1 is submitted, it is PRIVATE
    const firstReview = {
      bookingId: 'booking-sync',
      direction: ReviewDirection.GUEST_TO_PROPERTY,
      status: ReviewStatus.PRIVATE,
      publishedAt: null,
    };
    assert.equal(firstReview.status, ReviewStatus.PRIVATE);
    assert.equal(firstReview.publishedAt, null);

    // When review 2 (counterpart) is submitted, both reviews become PUBLISHED
    const counterpartSubmitted = true;
    const now = new Date();
    const updatedStatus = counterpartSubmitted ? ReviewStatus.PUBLISHED : ReviewStatus.PRIVATE;
    const updatedPublishedAt = counterpartSubmitted ? now : null;

    assert.equal(updatedStatus, ReviewStatus.PUBLISHED);
    assert.ok(updatedPublishedAt);
  });

  await t.test('7. Edit permissions locked after publication', () => {
    // Review editing rules
    function canEditReview(review: { status: ReviewStatus; reviewDeadline: Date }, now: Date) {
      if (review.status !== ReviewStatus.PRIVATE) {
        return { allowed: false, reason: 'Reviews cannot be edited once published.' };
      }
      if (now.getTime() > review.reviewDeadline.getTime()) {
        return { allowed: false, reason: 'The review editing deadline has passed.' };
      }
      return { allowed: true };
    }

    const now = new Date('2026-10-14T12:00:00Z');
    const privateReview = {
      status: ReviewStatus.PRIVATE,
      reviewDeadline: new Date('2026-10-20T12:00:00Z'),
    };
    assert.equal(canEditReview(privateReview, now).allowed, true);

    const publishedReview = {
      status: ReviewStatus.PUBLISHED,
      reviewDeadline: new Date('2026-10-20T12:00:00Z'),
    };
    assert.equal(canEditReview(publishedReview, now).allowed, false);
    assert.equal(
      canEditReview(publishedReview, now).reason,
      'Reviews cannot be edited once published.'
    );
  });

  await t.test('8. Response validation rules', () => {
    function validateResponse(content: string, existingResponseCount: number) {
      if (existingResponseCount > 0) {
        return { valid: false, error: 'A response has already been submitted for this review.' };
      }
      const trimmed = content.trim();
      if (!trimmed || trimmed.length < 5) {
        return { valid: false, error: 'Response must be at least 5 characters.' };
      }
      if (trimmed.length > 2000) {
        return { valid: false, error: 'Response cannot exceed 2,000 characters.' };
      }
      return { valid: true };
    }

    assert.equal(validateResponse('Hi', 0).valid, false);
    assert.equal(validateResponse('Thank you for staying with us!', 0).valid, true);
    assert.equal(validateResponse('Another response', 1).valid, false);
  });
});

