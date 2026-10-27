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
  // Find users with duplicate trip titles
  const usersWithTrips = await prisma.travelTrip.groupBy({
    by: ['userId'],
    _count: { id: true },
    having: { id: { _count: { gt: 0 } } },
  });
  
  for (const u of usersWithTrips) {
    const trips = await prisma.travelTrip.findMany({
      where: { userId: u.userId },
      include: { _count: { select: { photos: true } }, photos: true },
      orderBy: { createdAt: 'asc' }
    });
    
    // Group by title
    const byTitle: Record<string, typeof trips> = {};
    for (const t of trips) {
      if (!byTitle[t.title]) byTitle[t.title] = [];
      byTitle[t.title].push(t);
    }
    
    for (const [title, titleTrips] of Object.entries(byTitle)) {
      if (titleTrips.length > 1) {
        console.log(`\nUser ${u.userId}: Found ${titleTrips.length} trips with title "${title}"`);
        
        // Keep the oldest (first) trip, merge others into it
        const [keepTrip, ...duplicateTrips] = titleTrips;
        console.log(`  Keeping: ${keepTrip.id} (created: ${keepTrip.createdAt}, photos: ${keepTrip._count.photos})`);
        
        for (const dup of duplicateTrips) {
          console.log(`  Merging: ${dup.id} (created: ${dup.createdAt}, photos: ${dup._count.photos})`);
          
          // Move photos from duplicate to kept trip
          if (dup.photos.length > 0) {
            await prisma.travelPhoto.updateMany({
              where: { tripId: dup.id },
              data: { tripId: keepTrip.id }
            });
            console.log(`    Moved ${dup.photos.length} photos to ${keepTrip.id}`);
          }
          
          // Delete the duplicate trip
          await prisma.travelTrip.delete({ where: { id: dup.id } });
          console.log(`    Deleted duplicate trip ${dup.id}`);
        }
      }
    }
  }
  
  console.log('\nCleanup complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
