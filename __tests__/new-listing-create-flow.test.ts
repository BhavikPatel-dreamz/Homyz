import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldStayOnCreateWizard } from "@/app/(protected)/host/listings/new/page";

describe("new listing create-flow routing", () => {
  it("keeps new drafts inside the step-by-step wizard", () => {
    assert.equal(shouldStayOnCreateWizard({ isNewDraft: true }), true);
    assert.equal(shouldStayOnCreateWizard({ isNewDraft: false }), false);
  });
});
