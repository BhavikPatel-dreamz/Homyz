import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { updateListingSchema } from "../lib/validation/listing";

const photoUrl = "/uploads/listing-photos/2026/11/preserved-photo.jpg";

describe("listing editor scoped updates", () => {
  it("does not inject defaults into a title-only update", () => {
    const update = updateListingSchema.parse({
      title: "Premium Apartment Near City Center",
    });

    assert.deepEqual(update, {
      title: "Premium Apartment Near City Center",
    });
    assert.equal("photos" in update, false);
  });

  it("does not inject title or unrelated fields into a photo-only update", () => {
    const update = updateListingSchema.parse({ photos: [photoUrl] });

    assert.deepEqual(update, { photos: [photoUrl] });
    assert.equal("title" in update, false);
    assert.equal("amenities" in update, false);
    assert.equal("price" in update, false);
  });

  it("accepts concurrent field-scoped title and photo payloads independently", () => {
    const titleUpdate = updateListingSchema.parse({ title: "Updated title" });
    const photoUpdate = updateListingSchema.parse({ photos: [photoUrl] });
    const persisted = {
      title: "Original title",
      photos: ["/uploads/listing-photos/2026/11/existing-photo.jpg"],
      amenities: ["wifi"],
    };

    const afterTitle = { ...persisted, ...titleUpdate };
    const afterBoth = { ...afterTitle, ...photoUpdate };

    assert.equal(afterBoth.title, "Updated title");
    assert.deepEqual(afterBoth.photos, [photoUrl]);
    assert.deepEqual(afterBoth.amenities, ["wifi"]);
  });
});
