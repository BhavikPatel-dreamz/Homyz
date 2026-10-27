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
  // Fix photo order for Milan trip
  const milanTrip = await prisma.travelTrip.findUnique({
    where: { id: 'cmvq9spsd005rm9as041x3d39' },
    include: { photos: { orderBy: { createdAt: 'asc' } } }
  });
  
  if (milanTrip && milanTrip.photos.length > 0) {
    for (let i = 0; i < milanTrip.photos.length; i++) {
      await prisma.travelPhoto.update({
        where: { id: milanTrip.photos[i].id },
        data: { order: i }
      });
      console.log(`Fixed Milan photo order: ${milanTrip.photos[i].id} -> ${i}`);
    }
  }
  
  // Fix photo order for Paris trip
  const parisTrip = await prisma.travelTrip.findUnique({
    where: { id: 'cmvq7lanl000ivbasx1vfyont' },
    include: { photos: { orderBy: { createdAt: 'asc' } } }
  });
  
  if (parisTrip && parisTrip.photos.length > 0) {
    for (let i = 0; i < parisTrip.photos.length; i++) {
      await prisma.travelPhoto.update({
        where: { id: parisTrip.photos[i].id },
        data: { order: i }
      });
      console.log(`Fixed Paris photo order: ${parisTrip.photos[i].id} -> ${i}`);
    }
  }
  
  // Fix all other trips
  const allTrips = await prisma.travelTrip.findMany({
    include: { photos: { orderBy: { createdAt: 'asc' } } }
  });
  
  for (const trip of allTrips) {
    if (trip.photos.length > 0) {
      for (let i = 0; i < trip.photos.length; i++) {
        await prisma.travelPhoto.update({
          where: { id: trip.photos[i].id },
          data: { order: i }
        });
      }
    }
  }
  
  console.log('\nAll photo orders fixed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
