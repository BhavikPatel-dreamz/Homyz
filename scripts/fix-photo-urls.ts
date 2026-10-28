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
  const publicBase = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const apply = process.argv.includes("--apply");
  if (!publicBase || /^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(publicBase)) {
    throw new Error("Set MEDIA_PUBLIC_BASE_URL to the browser-reachable media origin before repairing URLs.");
  }
  
  const photos = await prisma.travelPhoto.findMany({
    where: {
      url: { startsWith: "http://127.0.0.1:4001" }
    }
  });
  
  console.log(`Found ${photos.length} travel photos using an internal media URL`);
  
  for (const photo of photos) {
    const repairedUrl = photo.url.replace(/^http:\/\/127\.0\.0\.1:4001/i, publicBase);
    console.log(`${apply ? "Repairing" : "Would repair"} photo ${photo.id}: ${repairedUrl}`);
    if (apply) {
      await prisma.travelPhoto.update({
        where: { id: photo.id },
        data: { url: repairedUrl, mediumUrl: repairedUrl, thumbnailUrl: repairedUrl },
      });
    }
  }
  
  // Also fix legacy tripPhoto records
  const legacyPhotos = await prisma.tripPhoto.findMany({
    where: {
      url: { startsWith: "http://127.0.0.1:4001" }
    }
  });
  
  console.log(`Found ${legacyPhotos.length} legacy photos using an internal media URL`);
  
  for (const photo of legacyPhotos) {
    const repairedUrl = photo.url.replace(/^http:\/\/127\.0\.0\.1:4001/i, publicBase);
    console.log(`${apply ? "Repairing" : "Would repair"} legacy photo ${photo.id}: ${repairedUrl}`);
    if (apply) {
      await prisma.tripPhoto.update({ where: { id: photo.id }, data: { url: repairedUrl } });
    }
  }
  
  console.log(apply ? "\nMedia URL repair complete." : "\nAudit complete. Re-run with --apply after verifying the output.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
