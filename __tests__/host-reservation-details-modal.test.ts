import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getAuthoritativePriceBreakdown } from "../lib/booking/booking-price";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Host reservation details modal", () => {
  it("reconciles the historical service-fee snapshot to the immutable guest total", () => {
    const pricing = getAuthoritativePriceBreakdown({
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nightlyPrice: 53_000,
      totalPrice: 130_610,
      currency: "SAR",
      priceBreakdown: {
        nightlySubtotal: 106_000,
        discountAmount: 0,
        extraGuestFee: 0,
        petFee: 0,
        taxTotal: 20_900,
        hostServiceFee: 3_710,
        taxes: [
          { taxName: "Saudi Value-Added Tax (VAT)", taxAmount: 15_900 },
          { taxName: "Riyadh Municipal Tourism Fee", taxAmount: 5_000 },
        ],
      },
    });

    assert.equal(pricing.otherCharges, 3_710);
    assert.equal(
      pricing.nightlySubtotal -
        pricing.discountAmount +
        pricing.extraGuestFee +
        pricing.petFee +
        pricing.taxTotal +
        pricing.otherCharges,
      pricing.totalPrice,
    );
    assert.equal(pricing.totalPrice, 130_610);
  });

  it("keeps the header fixed while only the reservation body scrolls", () => {
    const component = read("components/host/host-workspace-shared.tsx");

    assert.match(
      component,
      /variant === "reservation-details" \? "flex h-dvh max-h-dvh flex-col overflow-hidden/,
    );
    assert.match(
      component,
      /min-h-0 flex-1 overflow-y-auto overscroll-contain/,
    );
    assert.match(component, /z-10 shrink-0 border-zinc-200 bg-white/);
    assert.match(component, /variant="reservation-details"/);
  });

  it("uses real guest, conversation, invoice, and property data without placeholder claims", () => {
    const component = read("components/host/host-workspace-shared.tsx");
    const service = read("services/host-workspace.service.ts");
    const today = read("components/host/host-today-workspace.tsx");

    assert.doesNotMatch(component, /5\.0 rating from 1 review/);
    assert.doesNotMatch(component, /Identity verified/);
    assert.doesNotMatch(component, /Transaction history/);
    assert.match(component, /Message guest/);
    assert.match(component, /conversationId/);
    assert.match(component, /View VAT invoice/);
    assert.match(component, /getAuthoritativePriceBreakdown/);
    assert.match(service, /guestCreatedAt/);
    assert.match(service, /conversations: \{/);
    assert.doesNotMatch(today, /MoneyDialog/);
  });
});
