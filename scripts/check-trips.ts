import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Just get all trips
  const trips = await prisma.travelTrip.findMany({
    include: { _count: { select: { photos: true } } },
    orderBy: { createdAt: 'desc' }
  });
  
  // Group by userId
  const byUser: Record<string, typeof trips> = {};
  for (const t of trips) {
    if (!byUser[t.userId]) byUser[t.userId] = [];
    byUser[t.userId].push(t);
  }
  
  for (const [userId, userTrips] of Object.entries(byUser)) {
    console.log(`\nUser ${userId} trips (${userTrips.length}):`);
    userTrips.forEach(t => {
      console.log(`  - ${t.id}: "${t.title}" (photos: ${t._count.photos}, created: ${t.createdAt})`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
