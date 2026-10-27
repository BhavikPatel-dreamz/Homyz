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
  // Fix Milan trip - set coverPhotoId to first photo
  const milanTrip = await prisma.travelTrip.findUnique({
    where: { id: 'cmvq9spsd005rm9as041x3d39' },
    include: { photos: { orderBy: { order: 'asc' }, take: 1 } }
  });
  
  if (milanTrip && milanTrip.photos.length > 0) {
    await prisma.travelTrip.update({
      where: { id: milanTrip.id },
      data: { coverPhotoId: milanTrip.photos[0].id }
    });
    console.log(`Fixed Milan cover: ${milanTrip.photos[0].id}`);
  }
  
  // Fix Paris trip
  const parisTrip = await prisma.travelTrip.findUnique({
    where: { id: 'cmvq7lanl000ivbasx1vfyont' },
    include: { photos: { orderBy: { order: 'asc' }, take: 1 } }
  });
  
  if (parisTrip && parisTrip.photos.length > 0) {
    await prisma.travelTrip.update({
      where: { id: parisTrip.id },
      data: { coverPhotoId: parisTrip.photos[0].id }
    });
    console.log(`Fixed Paris cover: ${parisTrip.photos[0].id}`);
  }
  
  // Also fix trips for other users
  const allTrips = await prisma.travelTrip.findMany({
    where: { coverPhotoId: null },
    include: { photos: { orderBy: { order: 'asc' }, take: 1 } }
  });
  
  for (const trip of allTrips) {
    if (trip.photos.length > 0) {
      await prisma.travelTrip.update({
        where: { id: trip.id },
        data: { coverPhotoId: trip.photos[0].id }
      });
      console.log(`Fixed cover for ${trip.title} (${trip.id}): ${trip.photos[0].id}`);
    }
  }
  
  console.log('\nAll covers fixed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
