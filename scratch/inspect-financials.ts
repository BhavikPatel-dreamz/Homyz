import dotenv from "dotenv";
import { prisma } from "../lib/db/prisma";

async function main() {
  const [bookingCount, paymentCount, refundCount] = await Promise.all([
    prisma.booking.count(),
    prisma.bookingPayment.count(),
    prisma.bookingRefund.count(),
  ]);

  console.log("Database Stats:", {
    bookings: bookingCount,
    payments: paymentCount,
    refunds: refundCount,
  });

  const sampleBookings = await prisma.booking.findMany({
    take: 5,
    select: {
      id: true,
      status: true,
      totalPrice: true,
      currency: true,
      payments: true,
      refunds: true,
    },
  });

  console.log("Sample Bookings:", JSON.stringify(sampleBookings, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
