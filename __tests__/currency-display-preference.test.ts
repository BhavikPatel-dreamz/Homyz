import assert from "node:assert/strict";
import { formatConvertedListingPrice } from "@/lib/currency";

assert.equal(formatConvertedListingPrice(50000, "SAR", "SAR"), "SAR 500");
assert.equal(formatConvertedListingPrice(50000, "SAR", "USD"), "$133");
assert.equal(formatConvertedListingPrice(350000, "INR", "EUR"), "€39");
assert.equal(formatConvertedListingPrice(120000, "AED", "INR"), "₹27,229");

console.log("Currency display preference conversion checks passed.");
