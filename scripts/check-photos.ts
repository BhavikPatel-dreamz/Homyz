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
  // Check photos for the Milan trip
  const trip = await prisma.travelTrip.findUnique({
    where: { id: 'cmvq9spsd005rm9as041x3d39' },
    include: { 
      photos: {
        orderBy: { order: 'asc' }
      }
    }
  });
  
  if (trip) {
    console.log(`Trip: ${trip.title} (${trip.id})`);
    console.log(`CoverPhotoId: ${trip.coverPhotoId}`);
    console.log(`Photos count: ${trip.photos.length}`);
    trip.photos.forEach((p, i) => {
      console.log(`  [${i}] ${p.id}: url=${p.url}, mediumUrl=${p.mediumUrl}, thumbnailUrl=${p.thumbnailUrl}, order=${p.order}`);
    });
  }
  
  // Check Paris trip
  const parisTrip = await prisma.travelTrip.findUnique({
    where: { id: 'cmvq7lanl000ivbasx1vfyont' },
    include: { 
      photos: {
        orderBy: { order: 'asc' }
      }
    }
  });
  
  if (parisTrip) {
    console.log(`\nTrip: ${parisTrip.title} (${parisTrip.id})`);
    console.log(`CoverPhotoId: ${parisTrip.coverPhotoId}`);
    console.log(`Photos count: ${parisTrip.photos.length}`);
    parisTrip.photos.forEach((p, i) => {
      console.log(`  [${i}] ${p.id}: url=${p.url}, mediumUrl=${p.mediumUrl}, thumbnailUrl=${p.thumbnailUrl}, order=${p.order}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
