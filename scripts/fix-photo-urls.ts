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
  // Update photos with 127.0.0.1 URLs to use fallback image
  const fallbackUrl = "/images/auth-traveler-water.jpg";
  const fallbackMedium = "/images/auth-traveler-water.jpg?w=768&q=80";
  const fallbackThumb = "/images/auth-traveler-water.jpg?w=320&q=75";
  
  const photos = await prisma.travelPhoto.findMany({
    where: {
      url: { startsWith: "http://127.0.0.1:4001" }
    }
  });
  
  console.log(`Found ${photos.length} photos with broken URLs`);
  
  for (const photo of photos) {
    await prisma.travelPhoto.update({
      where: { id: photo.id },
      data: {
        url: fallbackUrl,
        mediumUrl: fallbackMedium,
        thumbnailUrl: fallbackThumb,
      }
    });
    console.log(`Fixed photo ${photo.id}`);
  }
  
  // Also fix legacy tripPhoto records
  const legacyPhotos = await prisma.tripPhoto.findMany({
    where: {
      url: { startsWith: "http://127.0.0.1:4001" }
    }
  });
  
  console.log(`Found ${legacyPhotos.length} legacy photos with broken URLs`);
  
  for (const photo of legacyPhotos) {
    await prisma.tripPhoto.update({
      where: { id: photo.id },
      data: {
        url: fallbackUrl,
      }
    });
    console.log(`Fixed legacy photo ${photo.id}`);
  }
  
  console.log('\nAll photo URLs fixed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
