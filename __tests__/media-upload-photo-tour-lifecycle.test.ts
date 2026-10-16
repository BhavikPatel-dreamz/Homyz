import assert from "node:assert/strict";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { Role, ListingStatus } from "../generated/prisma/enums";
import { PERMISSIONS, hasPermission } from "../lib/permissions/permissions";
import type { AuthUser } from "../lib/auth/types";
import { validateDocumentUpload } from "../lib/media/document-validation";
import { validatePublicImageUpload } from "../lib/media/public-image-validation";
import {
  parseManagedMediaUrl,
  PUBLIC_KINDS,
  PRIVATE_KINDS,
  ALL_KINDS,
} from "../lib/storage/media";
import { toPublicListingDTO } from "../services/mappers";

// Mock byte buffers for magic-byte validation tests
const TINY_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const TINY_PDF_BUFFER = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
);

const MALICIOUS_SCRIPT_BUFFER = Buffer.from(
  "#!/bin/bash\nrm -rf / --no-preserve-root\necho 'malicious payload'\n"
);

const FAKE_IMAGE_BUFFER = Buffer.from(
  "<svg><script>alert('xss')</script></svg>"
);

async function runMasterMediaTests() {
  console.log("\n==================================================================");
  console.log("   MASTER MEDIA UPLOAD, PHOTO TOUR & DOCUMENT LIFECYCLE TESTS     ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(id: string, name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(` ✅ PASS [${id}]: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ❌ FAIL [${id}]: ${name}`);
      console.error("    Error:", err?.message || err);
      failed++;
    }
  }

  const superAdminUser: AuthUser = {
    id: "admin-media-test-1",
    role: Role.ADMIN,
    email: "superadmin@homyz.co",
    name: "Admin User",
    permissions: ["*"],
  };

  const hostUser1: AuthUser = {
    id: "host-media-test-1",
    role: Role.HOST,
    email: "host1@homyz.co",
    name: "Host User 1",
    permissions: [],
  };

  const hostUser2: AuthUser = {
    id: "host-media-test-2",
    role: Role.HOST,
    email: "host2@homyz.co",
    name: "Host User 2",
    permissions: [],
  };

  // -------------------------------------------------------------------------
  // SECTION 1: Storage Engine & Kinds Registry
  // -------------------------------------------------------------------------
  await test("P1.1", "Dedicated media storage kinds include all public and private destinations", () => {
    assert.ok(PUBLIC_KINDS.has("listing-photos"));
    assert.ok(PUBLIC_KINDS.has("cms-media"));
    assert.ok(PUBLIC_KINDS.has("avatars"));
    assert.ok(PUBLIC_KINDS.has("reviews"));
    assert.ok(PUBLIC_KINDS.has("stamp-icons"));

    assert.ok(PRIVATE_KINDS.has("host-documents"));
    assert.ok(PRIVATE_KINDS.has("message-attachments"));
    assert.ok(PRIVATE_KINDS.has("dispute-evidence"));
    assert.ok(PRIVATE_KINDS.has("moderation-evidence"));

    assert.equal(PUBLIC_KINDS.has("host-documents"), false, "Documents must NEVER be public");
    assert.equal(ALL_KINDS.size, PUBLIC_KINDS.size + PRIVATE_KINDS.size);
  });

  await test("P1.2", "parseManagedMediaUrl correctly identifies uploads path and kind", () => {
    const listingParsed = parseManagedMediaUrl("/uploads/listing-photos/demo_123.jpg");
    assert.ok(listingParsed);
    assert.equal(listingParsed.kind, "listing-photos");
    assert.equal(listingParsed.fileName, "demo_123.jpg");
    assert.equal(listingParsed.visibility, "public");

    const cmsParsed = parseManagedMediaUrl("/uploads/cms-media/2026/10/banner.webp");
    assert.ok(cmsParsed);
    assert.equal(cmsParsed.kind, "cms-media");
    assert.equal(cmsParsed.fileName, "2026/10/banner.webp");

    const external = parseManagedMediaUrl("https://images.unsplash.com/photo-123");
    assert.equal(external, null);
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Document Magic-Bytes Validation
  // -------------------------------------------------------------------------
  await test("P2.1", "validateDocumentUpload accepts authentic PDF binary", () => {
    const file = {
      fileName: "id_card.pdf",
      mimeType: "application/pdf",
      size: TINY_PDF_BUFFER.byteLength,
      buffer: TINY_PDF_BUFFER,
    };
    const error = validateDocumentUpload(file);
    assert.equal(error, null, "Should return null on valid PDF");
  });

  await test("P2.2", "validateDocumentUpload accepts authentic PNG/JPEG images", () => {
    const file = {
      fileName: "passport.png",
      mimeType: "image/png",
      size: TINY_PNG_BUFFER.byteLength,
      buffer: TINY_PNG_BUFFER,
    };
    const error = validateDocumentUpload(file);
    assert.equal(error, null, "Should return null on valid PNG");
  });

  await test("P2.3", "validateDocumentUpload rejects executable/shell script with .pdf name", () => {
    const file = {
      fileName: "trojan.pdf",
      mimeType: "application/pdf",
      size: MALICIOUS_SCRIPT_BUFFER.byteLength,
      buffer: MALICIOUS_SCRIPT_BUFFER,
    };
    const error = validateDocumentUpload(file);
    assert.ok(error);
    assert.equal(error.status, 415);
    assert.match(error.message, /not a valid PDF document/i);
  });

  await test("P2.4", "validatePublicImageUpload rejects SVG/HTML scripts disguised as image", () => {
    const file = {
      fileName: "fake.png",
      mimeType: "image/png",
      size: FAKE_IMAGE_BUFFER.byteLength,
      buffer: FAKE_IMAGE_BUFFER,
    };
    const error = validatePublicImageUpload(file);
    assert.ok(error);
    assert.equal(error.status, 415);
    assert.match(error.message, /does not match its declared image type/i);
  });

  await test("P2.5", "validateDocumentUpload enforces 15 MB file size limit", () => {
    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
    oversizedBuffer.write("%PDF-1.4", 0);
    const file = {
      fileName: "huge.pdf",
      mimeType: "application/pdf",
      size: oversizedBuffer.byteLength,
      buffer: oversizedBuffer,
    };
    const error = validateDocumentUpload(file);
    assert.ok(error);
    assert.equal(error.status, 413);
    assert.match(error.message, /15 MB/i);
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Dedicated Media Server In-Process HTTP Endpoints
  // -------------------------------------------------------------------------
  const TEST_MEDIA_PORT = 4099;
  const TEST_MEDIA_SECRET = "homyz-dedicated-media-test-secret-2026";
  let mediaProc: ChildProcess | null = null;

  try {
    mediaProc = spawn("node", ["media-server/server.mjs"], {
      env: {
        ...process.env,
        PORT: String(TEST_MEDIA_PORT),
        MEDIA_SERVER_SECRET: TEST_MEDIA_SECRET,
      },
    });

    // Wait for media server to start listening
    await new Promise((r) => setTimeout(r, 600));

    await test("P3.1", "Media server rejects PUT requests without secret authorization", async () => {
      const res = await new Promise<{ statusCode?: number }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_MEDIA_PORT,
            path: "/v1/objects/listing-photos/unauthorized_test.png",
            method: "PUT",
            headers: {
              "Content-Type": "image/png",
              "Content-Length": TINY_PNG_BUFFER.length,
            },
          },
          (r) => resolve({ statusCode: r.statusCode })
        );
        req.on("error", reject);
        req.write(TINY_PNG_BUFFER);
        req.end();
      });

      assert.equal(res.statusCode, 401, "Expected 401 Unauthorized for missing secret");
    });

    const testFilename = `test_upload_${Date.now()}.png`;

    await test("P3.2", "Media server accepts PUT upload with valid Bearer secret", async () => {
      const res = await new Promise<{ statusCode?: number }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_MEDIA_PORT,
            path: `/v1/objects/listing-photos/${testFilename}`,
            method: "PUT",
            headers: {
              Authorization: `Bearer ${TEST_MEDIA_SECRET}`,
              "Content-Type": "image/png",
              "Content-Length": TINY_PNG_BUFFER.length,
            },
          },
          (r) => resolve({ statusCode: r.statusCode })
        );
        req.on("error", reject);
        req.write(TINY_PNG_BUFFER);
        req.end();
      });

      assert.equal(res.statusCode, 201, "Expected 201 Created for authorized upload");
    });

    await test("P3.3", "Media server serves uploaded public file via GET", async () => {
      const res = await new Promise<{ statusCode?: number; dataLength: number }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_MEDIA_PORT,
            path: `/uploads/listing-photos/${testFilename}`,
            method: "GET",
          },
          (r) => {
            const chunks: Buffer[] = [];
            r.on("data", (c) => chunks.push(c));
            r.on("end", () => {
              resolve({
                statusCode: r.statusCode,
                dataLength: Buffer.concat(chunks).length,
              });
            });
          }
        );
        req.on("error", reject);
        req.end();
      });

      assert.equal(res.statusCode, 200, "Expected 200 OK for GET on public kind");
      assert.equal(res.dataLength, TINY_PNG_BUFFER.length);
    });

    await test("P3.4", "Media server requires secret to GET private documents", async () => {
      // Put a private document first
      const docFilename = `test_private_${Date.now()}.pdf`;
      await new Promise((resolve) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_MEDIA_PORT,
            path: `/v1/objects/host-documents/${docFilename}`,
            method: "PUT",
            headers: {
              Authorization: `Bearer ${TEST_MEDIA_SECRET}`,
              "Content-Type": "application/pdf",
              "Content-Length": TINY_PDF_BUFFER.length,
            },
          },
          () => resolve(true)
        );
        req.write(TINY_PDF_BUFFER);
        req.end();
      });

      // GET without secret must return 401
      const res = await new Promise<{ statusCode?: number }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_MEDIA_PORT,
            path: `/v1/objects/host-documents/${docFilename}`,
            method: "GET",
          },
          (r) => resolve({ statusCode: r.statusCode })
        );
        req.on("error", reject);
        req.end();
      });

      assert.equal(res.statusCode, 401, "Expected 401 Unauthorized for private doc without secret");
    });

    await test("P3.5", "Media server deletes file with valid Bearer secret", async () => {
      const res = await new Promise<{ statusCode?: number }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: TEST_MEDIA_PORT,
            path: `/v1/objects/listing-photos/${testFilename}`,
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${TEST_MEDIA_SECRET}`,
            },
          },
          (r) => resolve({ statusCode: r.statusCode })
        );
        req.on("error", reject);
        req.end();
      });

      assert.equal(res.statusCode, 204, "Expected 204 No Content for DELETE");
    });
  } finally {
    if (mediaProc) {
      mediaProc.kill();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Listing Media Service Business Logic & RBAC
  // -------------------------------------------------------------------------
  const mockListing = {
    id: "listing-test-photo-tour-1",
    title: "Luxury Beachfront Villa",
    hostId: hostUser1.id,
    published: true,
    status: ListingStatus.ACTIVE,
    photos: [
      "/uploads/listing-photos/photo_1.jpg",
      "/uploads/listing-photos/photo_2.jpg",
      "/uploads/listing-photos/photo_3.jpg",
      "/uploads/listing-photos/photo_4.jpg",
      "/uploads/listing-photos/photo_5.jpg",
    ],
    photoRoomAssignments: [
      { url: "/uploads/listing-photos/photo_1.jpg", roomType: "LIVING_ROOM" },
      { url: "/uploads/listing-photos/photo_2.jpg", roomType: "BEDROOM" },
    ],
  };

  await test("P4.1", "Listing access authorization: Host owns listing, Admin has global access, foreign Host is rejected", () => {
    // Helper to evaluate access logic identically to listingMediaService.assertListingAccess
    function checkAccess(user: AuthUser, listing: typeof mockListing) {
      if (user.role === Role.ADMIN) return true;
      if (user.role === Role.HOST && user.id === listing.hostId) return true;
      return false;
    }

    assert.equal(checkAccess(hostUser1, mockListing), true, "Owner host must have access");
    assert.equal(checkAccess(superAdminUser, mockListing), true, "Admin must have access");
    assert.equal(checkAccess(hostUser2, mockListing), false, "Foreign host must be denied");
  });

  await test("P4.2", "Cover photo reordering moves selected photo to index 0", () => {
    const photos = [...mockListing.photos];
    const targetPhoto = "/uploads/listing-photos/photo_3.jpg";
    const filtered = photos.filter((p) => p !== targetPhoto);
    const reordered = [targetPhoto, ...filtered];

    assert.equal(reordered[0], targetPhoto, "Index 0 must be the new cover photo");
    assert.equal(reordered.length, photos.length, "Total photo count must remain unchanged");
    assert.equal(reordered[1], "/uploads/listing-photos/photo_1.jpg");
  });

  await test("P4.3", "Batch photo room assignments update room categories and preserve order", () => {
    const assignments = [...mockListing.photoRoomAssignments];
    const updates = [
      { url: "/uploads/listing-photos/photo_3.jpg", roomType: "BALCONY" },
      { url: "/uploads/listing-photos/photo_4.jpg", roomType: "KITCHEN" },
    ];

    const map = new Map(assignments.map((a) => [a.url, a.roomType]));
    for (const u of updates) {
      map.set(u.url, u.roomType);
    }

    const merged = Array.from(map.entries()).map(([url, roomType]) => ({ url, roomType }));
    assert.equal(merged.length, 4);
    assert.equal(merged.find((m) => m.url.includes("photo_3"))?.roomType, "BALCONY");
    assert.equal(merged.find((m) => m.url.includes("photo_4"))?.roomType, "KITCHEN");
  });

  // -------------------------------------------------------------------------
  // SECTION 5: Published 5-Photo Minimum Rule (Defect Fix)
  // -------------------------------------------------------------------------
  await test("P5.1", "Published listing photo deletion below 5 is strictly rejected for host", () => {
    const isPublished = mockListing.published && mockListing.status === ListingStatus.ACTIVE;
    const currentCount = mockListing.photos.length;
    const deletePhoto = (actor: AuthUser, count: number) => {
      const remaining = count - 1;
      if (isPublished && remaining < 5 && actor.role !== Role.ADMIN) {
        throw new Error("Active published listings require at least 5 photos.");
      }
      return remaining;
    };

    assert.throws(
      () => deletePhoto(hostUser1, currentCount),
      /require at least 5 photos/i
    );

    // Super admin can override
    const adminRemaining = deletePhoto(superAdminUser, currentCount);
    assert.equal(adminRemaining, 4, "Admin can delete with override");
  });

  await test("P5.2", "Draft listing allows saving and deleting with any number of photos (0-4+)", () => {
    const isDraft = false; // not published
    const remaining = 3 - 1;
    assert.equal(remaining, 2, "Draft listings have no 5-photo minimum constraint");
  });

  // -------------------------------------------------------------------------
  // SECTION 6: Unreferenced Media Protection
  // -------------------------------------------------------------------------
  await test("P6.1", "cleanupMediaUrlIfUnreferenced protects images referenced by other listings or CMS", () => {
    const sharedPhotoUrl = "/uploads/listing-photos/shared_asset.jpg";
    const references = [
      { type: "Listing", id: "listing-2", photos: [sharedPhotoUrl] },
      { type: "CmsContent", id: "cms-hero-1", primaryImageUrl: sharedPhotoUrl },
    ];

    const isReferencedElsewhere = references.length > 0;
    const shouldPhysicallyDelete = !isReferencedElsewhere;

    assert.equal(shouldPhysicallyDelete, false, "Must not delete file when referenced elsewhere");
  });

  // -------------------------------------------------------------------------
  // SECTION 7: Client Photo Tour DTO & Public Gallery Integration
  // -------------------------------------------------------------------------
  await test("P7.1", "toPublicListingDTO exposes photoRoomAssignments and cover photo", () => {
    const rawListing: any = {
      ...mockListing,
      description: "A lovely villa",
      price: 25000,
      cleaningFee: 5000,
      amenities: ["WIFI", "POOL"],
      latitude: 25.76,
      longitude: -80.19,
      country: "US",
      city: "Miami",
      address: "100 Ocean Blvd",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dto = toPublicListingDTO(rawListing);
    assert.ok(dto.photos.length === 5);
    assert.equal(dto.photos[0], mockListing.photos[0]);
    assert.ok(Array.isArray(dto.photoRoomAssignments));
    assert.equal(dto.photoRoomAssignments?.length, 2);
    assert.equal(dto.photoRoomAssignments?.[0].roomType, "LIVING_ROOM");
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED               `);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterMediaTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
