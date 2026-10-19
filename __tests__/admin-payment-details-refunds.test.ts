import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("==================================================================");
console.log("   ADMIN PAYMENT DETAILS REFUNDS SAFETY AUDIT                    ");
console.log("==================================================================");

// 1. Verify payment-admin.service.ts returns refunds
const servicePath = path.resolve(__dirname, "../services/payment-admin.service.ts");
assert(fs.existsSync(servicePath), "services/payment-admin.service.ts must exist");
const serviceCode = fs.readFileSync(servicePath, "utf-8");

console.log("\n--- [1] Service Level getPaymentDetailsForAdmin Return Audit ---");
assert(
  serviceCode.includes("refunds: payment.refunds ?? payment.booking?.refunds ?? []"),
  "getPaymentDetailsForAdmin must return refunds array at root level"
);
console.log("✓ Service returns refunds array properly!");

// 2. Verify admin-payment-details-client.tsx safely handles refunds
console.log("\n--- [2] Client Component Null-Safety Audit ---");
const clientPath = path.resolve(
  __dirname,
  "../app/(protected)/admin/bookings/payments/[id]/admin-payment-details-client.tsx"
);
assert(fs.existsSync(clientPath), "admin-payment-details-client.tsx must exist");
const clientCode = fs.readFileSync(clientPath, "utf-8");

assert(
  clientCode.includes("const refunds = data?.refunds ?? payment?.refunds ?? booking?.refunds ?? [];"),
  "admin-payment-details-client.tsx must safely resolve refunds with default empty array"
);
assert(
  clientCode.includes("refunds.length > 0"),
  "admin-payment-details-client.tsx must check refunds.length using safe variable"
);
assert(
  clientCode.includes("refunds.map("),
  "admin-payment-details-client.tsx must map over safe refunds variable"
);
assert(
  !clientCode.includes("data.refunds.length"),
  "admin-payment-details-client.tsx must NOT access data.refunds directly without null safety"
);
console.log("✓ Client component null safety verified!");

console.log("\n==================================================================");
console.log("   ALL ADMIN PAYMENT DETAILS REFUNDS TESTS PASSED!                ");
console.log("==================================================================\n");
