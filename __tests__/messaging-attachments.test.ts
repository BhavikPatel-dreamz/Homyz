import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db/prisma";
import { messagingService } from "../services/messaging.service";
import {
  ConversationType,
  ConversationStatus,
  MessageType,
  ListingStatus,
  Role,
} from "../generated/prisma/enums";

async function runMessagingAttachmentsSuite() {
  console.log("\n==================================================================");
  console.log("   TEST SUITE: HOMYZ MESSAGE ATTACHMENTS SYSTEM                  ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(description: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error("     ", err?.message || err);
      failed++;
    }
  }

  // --- [1] Static Architecture & API Routes Audit ---
  console.log("--- [1] Architecture, Routes & Storage Audit ---");

  await test("Attachment upload API route exists", () => {
    const routePath = path.resolve(
      __dirname,
      "../app/api/v1/messages/conversations/[id]/attachments/route.ts"
    );
    assert(fs.existsSync(routePath), "Attachments upload route must exist");
    const content = fs.readFileSync(routePath, "utf-8");
    assert(content.includes("uploadAttachment"), "Route must call uploadAttachment");
    assert(content.includes("requireApiAuth"), "Route must require authentication");
  });

  await test("Staged attachment delete API route exists", () => {
    const routePath = path.resolve(
      __dirname,
      "../app/api/v1/messages/conversations/[id]/attachments/[attachmentId]/route.ts"
    );
    assert(fs.existsSync(routePath), "Attachment delete route must exist");
    const content = fs.readFileSync(routePath, "utf-8");
    assert(content.includes("removeStagedAttachment"), "Route must call removeStagedAttachment");
    assert(content.includes("requireApiAuth"), "Route must require authentication");
  });

  await test("Attachment file streaming API route exists with security headers", () => {
    const routePath = path.resolve(
      __dirname,
      "../app/api/v1/messages/attachments/[id]/route.ts"
    );
    assert(fs.existsSync(routePath), "Attachment streaming route must exist");
    const content = fs.readFileSync(routePath, "utf-8");
    assert(content.includes("getAttachmentFile"), "Route must call getAttachmentFile");
    assert(content.includes("requireApiAuth"), "Route must require authentication");
    assert(content.includes("X-Content-Type-Options"), "Route must include nosniff header");
  });

  await test("HostMessagesWorkspace has paperclip button, file input, and lightbox modal with ModalOverlay", () => {
    const hostWsPath = path.resolve(
      __dirname,
      "../components/host/messages/host-messages-workspace.tsx"
    );
    const content = fs.readFileSync(hostWsPath, "utf-8");
    assert(content.includes("handleFileSelect"), "Host workspace must have handleFileSelect");
    assert(content.includes("stagedAttachments"), "Host workspace must track stagedAttachments");
    assert(content.includes("lightboxAttachment"), "Host workspace must support lightboxAttachment");
    assert(content.includes("ModalOverlay"), "Host workspace must use ModalOverlay for lightbox");
  });

  await test("GuestMessagesWorkspace has paperclip button, file input, and lightbox modal with ModalOverlay", () => {
    const guestWsPath = path.resolve(
      __dirname,
      "../components/messages/guest-messages-workspace.tsx"
    );
    const content = fs.readFileSync(guestWsPath, "utf-8");
    assert(content.includes("handleFileSelect"), "Guest workspace must have handleFileSelect");
    assert(content.includes("stagedAttachments"), "Guest workspace must track stagedAttachments");
    assert(content.includes("lightboxAttachment"), "Guest workspace must support lightboxAttachment");
    assert(content.includes("ModalOverlay"), "Guest workspace must use ModalOverlay for lightbox");
  });

  // --- [2] Live DB & Attachment Tests ---
  console.log("\n--- [2] Live DB & Attachment Validation Tests ---");

  const suffix = Date.now().toString().slice(-6);
  const guestUser = await prisma.user.create({
    data: {
      email: `test_att_guest_${suffix}@example.com`,
      name: `Attachment Guest ${suffix}`,
      role: Role.USER,
    },
  });

  const hostUser = await prisma.user.create({
    data: {
      email: `test_att_host_${suffix}@example.com`,
      name: `Attachment Host ${suffix}`,
      role: Role.HOST,
    },
  });

  const thirdPartyUser = await prisma.user.create({
    data: {
      email: `test_att_thirdparty_${suffix}@example.com`,
      name: `Third Party ${suffix}`,
      role: Role.USER,
    },
  });

  const listing = await prisma.listing.create({
    data: {
      hostId: hostUser.id,
      title: `Attachment Test Villa ${suffix}`,
      description: "Villa for testing attachments",
      price: 60000,
      cleaningFee: 5000,
      status: ListingStatus.ACTIVE,
      published: true,
      photos: ["https://example.com/photo1.jpg"],
    },
  });

  // Create an active conversation between guest and host
  const conversation = await prisma.conversation.create({
    data: {
      guestId: guestUser.id,
      hostId: hostUser.id,
      listingId: listing.id,
      type: ConversationType.INQUIRY,
      status: ConversationStatus.ACTIVE,
    },
  });

  const guestActor = { id: guestUser.id, email: guestUser.email, role: Role.USER, name: guestUser.name };
  const hostActor = { id: hostUser.id, email: hostUser.email, role: Role.HOST, name: hostUser.name };
  const thirdPartyActor = {
    id: thirdPartyUser.id,
    email: thirdPartyUser.email,
    role: Role.USER,
    name: thirdPartyUser.name,
  };

  // Sample buffers
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  ]);
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const validWebpBuffer = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP"),
    Buffer.from("VP8 "),
    Buffer.from([0x14, 0x00, 0x00, 0x00]),
  ]);
  const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

  let stagedImageId = "";
  let stagedDocId = "";

  // TEST A: Image upload & magic byte verification
  await test("TEST A: Image upload & magic byte verification (JPEG, PNG, WEBP)", async () => {
    // 1. JPEG
    const jpegAtt = await messagingService.uploadAttachment(guestActor, conversation.id, {
      fileName: "property_photo.jpg",
      mimeType: "image/jpeg",
      buffer: validJpegBuffer,
    });
    assert(jpegAtt.id, "Attachment ID must be returned");
    assert.strictEqual(jpegAtt.fileType, "IMAGE");
    assert.strictEqual(jpegAtt.mimeType, "image/jpeg");
    assert.strictEqual(jpegAtt.messageId, null, "Must be staged (unlinked) initially");
    assert(jpegAtt.fileUrl.includes(jpegAtt.id), "fileUrl must reference attachment ID");
    stagedImageId = jpegAtt.id;

    // 2. PNG
    const pngAtt = await messagingService.uploadAttachment(hostActor, conversation.id, {
      fileName: "diagram.png",
      mimeType: "image/png",
      buffer: validPngBuffer,
    });
    assert.strictEqual(pngAtt.fileType, "IMAGE");

    // 3. WebP
    const webpAtt = await messagingService.uploadAttachment(guestActor, conversation.id, {
      fileName: "scenery.webp",
      mimeType: "image/webp",
      buffer: validWebpBuffer,
    });
    assert.strictEqual(webpAtt.fileType, "IMAGE");
  });

  // TEST B: Document upload & magic byte verification (PDF)
  await test("TEST B: Document upload & magic byte verification (PDF)", async () => {
    const pdfAtt = await messagingService.uploadAttachment(hostActor, conversation.id, {
      fileName: "rental_agreement.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
    });
    assert(pdfAtt.id, "Document attachment ID must be returned");
    assert.strictEqual(pdfAtt.fileType, "DOCUMENT");
    assert.strictEqual(pdfAtt.mimeType, "application/pdf");
    stagedDocId = pdfAtt.id;
  });

  // TEST C: Spoofed extension / mime rejection
  await test("TEST C: Spoofed extension / mime rejection", async () => {
    // Claiming to be a PNG, but content is arbitrary script/executable
    const fakeBuffer = Buffer.from("<script>alert('xss')</script>");
    let threw = false;
    try {
      await messagingService.uploadAttachment(guestActor, conversation.id, {
        fileName: "innocent.png",
        mimeType: "image/png",
        buffer: fakeBuffer,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes("does not match"), "Must reject mismatched magic bytes");
    }
    assert(threw, "Must reject spoofed file content");
  });

  // TEST D: Disallowed extension rejection
  await test("TEST D: Disallowed extension rejection (.sh, .exe, .svg, .js)", async () => {
    const dangerousExtensions = ["malware.exe", "script.sh", "vector.svg", "app.js"];
    for (const extName of dangerousExtensions) {
      let threw = false;
      try {
        await messagingService.uploadAttachment(guestActor, conversation.id, {
          fileName: extName,
          mimeType: "application/octet-stream",
          buffer: validJpegBuffer,
        });
      } catch (err: any) {
        threw = true;
      }
      assert(threw, `Must reject disallowed extension: ${extName}`);
    }
  });

  // TEST E: Oversized file rejection (> 15MB)
  await test("TEST E: Oversized file rejection (> 15MB)", async () => {
    const oversizedBuffer = Buffer.alloc(15 * 1024 * 1024 + 1024);
    let threw = false;
    try {
      await messagingService.uploadAttachment(guestActor, conversation.id, {
        fileName: "huge.jpg",
        mimeType: "image/jpeg",
        buffer: oversizedBuffer,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes("15MB"), "Must mention 15MB limit");
    }
    assert(threw, "Must reject oversized file");
  });

  // TEST F: Empty file rejection (0 bytes)
  await test("TEST F: Empty file rejection (0 bytes)", async () => {
    const emptyBuffer = Buffer.alloc(0);
    let threw = false;
    try {
      await messagingService.uploadAttachment(guestActor, conversation.id, {
        fileName: "empty.jpg",
        mimeType: "image/jpeg",
        buffer: emptyBuffer,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes("empty"), "Must mention empty file");
    }
    assert(threw, "Must reject 0-byte file");
  });

  // TEST G: Strict Authorization & IDOR protection
  await test("TEST G: Strict Authorization & IDOR protection: User C cannot access attachments", async () => {
    // 1. User C cannot upload attachment to conversation they are not part of
    let threwUpload = false;
    try {
      await messagingService.uploadAttachment(thirdPartyActor, conversation.id, {
        fileName: "sneak.jpg",
        mimeType: "image/jpeg",
        buffer: validJpegBuffer,
      });
    } catch (err: any) {
      threwUpload = true;
    }
    assert(threwUpload, "User C must be forbidden from uploading to other's conversation");

    // 2. User C cannot delete staged attachment
    let threwDelete = false;
    try {
      await messagingService.removeStagedAttachment(thirdPartyActor, conversation.id, stagedImageId);
    } catch (err: any) {
      threwDelete = true;
    }
    assert(threwDelete, "User C must be forbidden from deleting other's attachment");

    // 3. User C cannot stream/read attachment
    let threwRead = false;
    try {
      await messagingService.getAttachmentFile(thirdPartyActor, stagedImageId);
    } catch (err: any) {
      threwRead = true;
    }
    assert(threwRead, "User C must be forbidden from accessing/reading attachment");
  });

  // TEST H: Staged attachment removal before message send
  await test("TEST H: Staged attachment removal before message send", async () => {
    const tempAtt = await messagingService.uploadAttachment(guestActor, conversation.id, {
      fileName: "temporary.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
    });

    const removeRes = await messagingService.removeStagedAttachment(
      guestActor,
      conversation.id,
      tempAtt.id
    );
    assert.strictEqual(removeRes.success, true);

    // Verify it is removed from DB
    const checkDb = await prisma.messageAttachment.findUnique({
      where: { id: tempAtt.id },
    });
    assert.strictEqual(checkDb, null, "Deleted attachment must not exist in DB");
  });

  // TEST I: Text + Attachment message sending
  let sentMessageWithAttId = "";
  await test("TEST I: Text + Attachment message sending: attachment is linked to message", async () => {
    const msg = await messagingService.sendMessage(guestActor, conversation.id, {
      content: "Here is the photo of the room I was asking about.",
      attachmentIds: [stagedImageId],
    });

    assert(msg.id, "Message ID must be returned");
    assert.strictEqual(msg.content, "Here is the photo of the room I was asking about.");
    assert(Array.isArray(msg.attachments), "attachments array must be present");
    assert.strictEqual(msg.attachments!.length, 1);
    assert.strictEqual(msg.attachments![0].id, stagedImageId);
    assert.strictEqual(msg.attachments![0].messageId, msg.id, "Attachment must be linked to message");
    sentMessageWithAttId = msg.id;

    // Verify in DB
    const attInDb = await prisma.messageAttachment.findUnique({
      where: { id: stagedImageId },
    });
    assert.strictEqual(attInDb?.messageId, msg.id, "DB messageId must match");
  });

  // TEST J: Attachment-only message sending
  await test("TEST J: Attachment-only message sending: text is optional when attachment is present", async () => {
    const msg = await messagingService.sendMessage(hostActor, conversation.id, {
      content: "",
      attachmentIds: [stagedDocId],
    });

    assert(msg.id, "Attachment-only message must be created");
    assert.strictEqual(msg.content, "");
    assert.strictEqual(msg.attachments?.length, 1);
    assert.strictEqual(msg.attachments![0].id, stagedDocId);
    assert.strictEqual(msg.attachments![0].fileType, "DOCUMENT");
  });

  // TEST K: Conversation list summary and notification preview for attachments
  await test("TEST K: Conversation list summary and notification preview", async () => {
    const hostConv = await messagingService.getConversationById(hostActor, conversation.id);
    assert(hostConv.lastMessage, "Conversation must have lastMessage");
    // Last message was document attachment without text
    assert(hostConv.lastMessage?.attachments?.length! > 0, "Last message must contain attachment");
  });

  // TEST L: Direct attachment streaming endpoint headers & binary integrity
  await test("TEST L: Direct attachment streaming returns valid buffer and metadata", async () => {
    // Participant (guest) can read attachment
    const { attachment, buffer } = await messagingService.getAttachmentFile(guestActor, stagedImageId);
    assert.strictEqual(attachment.id, stagedImageId);
    assert.strictEqual(attachment.mimeType, "image/jpeg");
    assert.strictEqual(buffer.length, validJpegBuffer.length);
    assert.deepStrictEqual(buffer, validJpegBuffer, "Streamed buffer must match original exactly");

    // Participant (host) can also read attachment
    const hostRead = await messagingService.getAttachmentFile(hostActor, stagedImageId);
    assert.deepStrictEqual(hostRead.buffer, validJpegBuffer);
  });

  // Clean up test data
  try {
    await prisma.messageAttachment.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.conversation.delete({ where: { id: conversation.id } });
    await prisma.listing.delete({ where: { id: listing.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [guestUser.id, hostUser.id, thirdPartyUser.id] } },
    });
  } catch (cleanErr) {
    console.warn("Cleanup error (safe to ignore):", cleanErr);
  }

  console.log("\n==================================================================");
  console.log(`   TEST MATRIX RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMessagingAttachmentsSuite().catch((err) => {
  console.error("Master attachment test execution failed:", err);
  process.exit(1);
});
