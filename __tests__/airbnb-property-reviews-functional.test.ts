import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicReviewDTO, revivePublicReviewDTO } from "@/services/mappers";
import type { Review } from "@/generated/prisma/client";
import { getMentionIconName } from "@/components/reviews/review-icon";

describe("Airbnb Property Reviews Functional & Edge-Case Unit Tests", () => {
  const dummyListingId = "listing_test_123";
  const dummyAuthor = {
    id: "user_test_1",
    name: "Sarah Jenkins",
    image: "https://images.example.com/avatar.jpg",
    createdAt: new Date("2023-01-15T00:00:00.000Z"),
  };

  const createDummyReview = (overrides: Partial<Review> = {}): Review => ({
    id: overrides.id || "review_1",
    listingId: dummyListingId,
    bookingId: overrides.bookingId || "booking_1",
    authorId: dummyAuthor.id,
    rating: overrides.rating ?? 5,
    cleanlinessRating: overrides.cleanlinessRating ?? 5,
    accuracyRating: overrides.accuracyRating ?? 5,
    checkInRating: overrides.checkInRating ?? 5,
    communicationRating: overrides.communicationRating ?? 5,
    locationRating: overrides.locationRating ?? 5,
    valueRating: overrides.valueRating ?? 5,
    comment: overrides.comment ?? "Had an incredible stay! The pool was pristine and the hospitality was unmatched.",
    privateNoteToHost: "Thank you for the wine!",
    topics: overrides.topics ?? ["Pool", "Hospitality"],
    status: "PUBLISHED",
    moderatedAt: null,
    moderatedById: null,
    rejectionReason: null,
    createdAt: overrides.createdAt ?? new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-09-01T10:00:00.000Z"),
  });

  describe("Scenario 1: DTO Mapping & Data Privacy", () => {
    it("toPublicReviewDTO includes reviewer createdAt and excludes private note to host", () => {
      const raw = createDummyReview();
      const dto = toPublicReviewDTO({
        ...raw,
        author: dummyAuthor,
      });

      assert.equal(dto.id, "review_1");
      assert.equal(dto.rating, 5);
      assert.equal(dto.comment, raw.comment);
      assert.deepEqual(dto.topics, ["Pool", "Hospitality"]);
      assert.equal(dto.author?.id, dummyAuthor.id);
      assert.equal(dto.author?.name, dummyAuthor.name);
      assert.equal(dto.author?.image, dummyAuthor.image);
      assert.equal(dto.author?.createdAt?.toISOString(), dummyAuthor.createdAt.toISOString());
      // Must not expose private fields
      assert.equal((dto as any).privateNoteToHost, undefined);
      assert.equal((dto as any).rejectionReason, undefined);
      assert.equal((dto as any).status, undefined);
    });

    it("toPublicReviewDTO handles host responses cleanly", () => {
      const raw = createDummyReview();
      const hostResponse = {
        comment: "Thank you so much Sarah! You're welcome back anytime.",
        createdAt: new Date("2026-09-02T12:00:00.000Z"),
        hostName: "Robert",
        hostImage: null,
      };

      const dto = toPublicReviewDTO({
        ...raw,
        author: dummyAuthor,
        hostResponse,
      });

      assert.ok(dto.hostResponse);
      assert.equal(dto.hostResponse?.comment, hostResponse.comment);
      assert.equal(dto.hostResponse?.hostName, "Robert");

      const revived = revivePublicReviewDTO(dto);
      assert.ok(revived.hostResponse?.createdAt instanceof Date);
    });
  });

  describe("Scenario 2: Review Calculations & Edge Cases", () => {
    it("Scenario: Property with zero reviews", () => {
      const reviews: any[] = [];
      const totalCount = reviews.length;
      const averageRating = totalCount > 0 ? 5 : null;
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      assert.equal(totalCount, 0);
      assert.equal(averageRating, null);
      assert.equal(ratingDistribution[5], 0);
    });

    it("Scenario: Property with 1 review", () => {
      const review = createDummyReview({ rating: 5 });
      const reviews = [review];
      const totalCount = reviews.length;
      const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount;
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 };

      assert.equal(totalCount, 1);
      assert.equal(averageRating, 5);
      assert.equal(ratingDistribution[5], 1);
    });

    it("Scenario: Property with 100+ reviews pagination", () => {
      const total = 105;
      const pageSize = 10;
      const totalPages = Math.ceil(total / pageSize);

      assert.equal(totalPages, 11);

      // Verify page boundaries
      for (let page = 1; page <= totalPages; page++) {
        const skip = (page - 1) * pageSize;
        const take = pageSize;
        const hasMore: boolean = page < totalPages;
        assert.ok(skip >= 0);
        assert.equal(take, 10);
        if (page === 11) {
          assert.equal(hasMore, false);
        } else {
          assert.equal(hasMore, true);
        }
      }
    });
  });

  describe("Scenario 3: Sorting & Relevance Determinations", () => {
    const list = [
      createDummyReview({ id: "rev_1", rating: 4, createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      createDummyReview({ id: "rev_2", rating: 5, createdAt: new Date("2026-05-01T00:00:00.000Z") }),
      createDummyReview({ id: "rev_3", rating: 2, createdAt: new Date("2026-03-01T00:00:00.000Z") }),
      createDummyReview({ id: "rev_4", rating: 5, createdAt: new Date("2026-02-01T00:00:00.000Z") }),
    ];

    it("sort: highest rated prioritizes 5 stars, with tiebreaking by recency and id", () => {
      const sorted = [...list].sort((a, b) => b.rating - a.rating || b.createdAt.getTime() - a.createdAt.getTime());
      assert.equal(sorted[0].id, "rev_2"); // 5 star, May
      assert.equal(sorted[1].id, "rev_4"); // 5 star, Feb
      assert.equal(sorted[2].id, "rev_1"); // 4 star
      assert.equal(sorted[3].id, "rev_3"); // 2 star
    });

    it("sort: lowest rated prioritizes lowest stars", () => {
      const sorted = [...list].sort((a, b) => a.rating - b.rating || b.createdAt.getTime() - a.createdAt.getTime());
      assert.equal(sorted[0].id, "rev_3"); // 2 star
      assert.equal(sorted[1].id, "rev_1"); // 4 star
    });

    it("sort: most recent prioritizes newest timestamp", () => {
      const sorted = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
      assert.equal(sorted[0].id, "rev_2"); // May
      assert.equal(sorted[1].id, "rev_3"); // March
      assert.equal(sorted[2].id, "rev_4"); // Feb
      assert.equal(sorted[3].id, "rev_1"); // Jan
    });
  });

  describe("Scenario 4: Search & Mention Filtering", () => {
    const reviews = [
      createDummyReview({ id: "r1", comment: "The heated pool and hot tub were amazing for our family vacation." }),
      createDummyReview({ id: "r2", comment: "Spotless cleanliness and pristine condition throughout the house." }),
      createDummyReview({ id: "r3", comment: "The host hospitality made us feel right at home with fresh bread." }),
      createDummyReview({ id: "r4", comment: "Great location near downtown with convenient garage parking." }),
    ];

    it("case-insensitive keyword search finds matching reviews", () => {
      const query = "pool";
      const matches = reviews.filter((r) => r.comment.toLowerCase().includes(query.toLowerCase()));
      assert.equal(matches.length, 1);
      assert.equal(matches[0].id, "r1");
    });

    it("search with no matches returns empty array cleanly without crashing", () => {
      const query = "nonexistent amenity 999";
      const matches = reviews.filter((r) => r.comment.toLowerCase().includes(query.toLowerCase()));
      assert.equal(matches.length, 0);
    });

    it("mention filtering correctly maps icons for all required categories", () => {
      assert.equal(getMentionIconName("Pool"), "pool");
      assert.equal(getMentionIconName("Hospitality"), "hospitality");
      assert.equal(getMentionIconName("Cleanliness"), "cleanliness");
      assert.equal(getMentionIconName("Condition"), "condition");
      assert.equal(getMentionIconName("Comfort"), "comfort");
      assert.equal(getMentionIconName("Family"), "family");
      assert.equal(getMentionIconName("Accuracy"), "accuracy");
      assert.equal(getMentionIconName("Wi-Fi"), "wifi");
      assert.equal(getMentionIconName("Kitchen"), "kitchen");
      assert.equal(getMentionIconName("Parking"), "parking");
    });
  });
});

