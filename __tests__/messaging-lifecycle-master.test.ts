import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db/prisma";
import { messagingService } from "../services/messaging.service";
import {
  ConversationType,
  ConversationStatus,
  MessageType,
  SpecialOfferStatus,
  BookingStatus,
  ListingStatus,
  Role,
} from "../generated/prisma/enums";

async function runMessagingLifecycleMasterSuite() {
  console.log("\n==================================================================");
  console.log("   MASTER TEST SUITE: HOMYZ GUEST ↔ HOST MESSAGING SYSTEM         ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${description}`);
        passed++;
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${description}`);
        console.error("     ", err?.message || err);
        failed++;
      }
    })();
  }

  // --- [1] Static Architecture & Route Audit ---
  console.log("--- [1] Architecture, Routes & UI File Audit ---");

  await test("Host Messages page exists and mounts 3-column HostMessagesWorkspace", () => {
    const hostPagePath = path.resolve(__dirname, "../app/(protected)/host/messages/page.tsx");
    assert(fs.existsSync(hostPagePath), "Host messages page must exist");
    const content = fs.readFileSync(hostPagePath, "utf-8");
    assert(content.includes("HostMessagesWorkspace"), "Host page must mount HostMessagesWorkspace");
    assert(content.includes("requirePageRole"), "Host page must guard access with requirePageRole");
  });

  await test("Guest Messages page exists and mounts 2-column GuestMessagesWorkspace", () => {
    const guestPagePath = path.resolve(__dirname, "../app/(protected)/messages/page.tsx");
    assert(fs.existsSync(guestPagePath), "Guest messages page must exist");
    const content = fs.readFileSync(guestPagePath, "utf-8");
    assert(content.includes("GuestMessagesWorkspace"), "Guest page must mount GuestMessagesWorkspace");
    assert(content.includes("requirePageUser"), "Guest page must guard access with requirePageUser");
  });

  await test("AppHeader and MainHeader link Messages to /messages", () => {
    const appHeaderPath = path.resolve(__dirname, "../components/dashboard/app-header.tsx");
    const appHeaderContent = fs.readFileSync(appHeaderPath, "utf-8");
    assert(appHeaderContent.includes('href="/messages"'), "AppHeader must link guest Messages to /messages");

    const mainHeaderPath = path.resolve(__dirname, "../components/home/main-header.tsx");
    const mainHeaderContent = fs.readFileSync(mainHeaderPath, "utf-8");
    assert(mainHeaderContent.includes('href="/messages"'), "MainHeader must link guest Messages to /messages");
  });

  await test("Listing detail page contains Message host action and Contact Host modal", () => {
    const listingDetailPath = path.resolve(__dirname, "../app/listings/[id]/public-listing-detail-client.tsx");
    const content = fs.readFileSync(listingDetailPath, "utf-8");
    assert(content.includes("Message host"), "Listing page must include Message host action");
    assert(content.includes("contactHostModalOpen"), "Listing page must track contactHostModalOpen");
    assert(content.includes("/api/v1/messages/inquiries"), "Listing page must submit to /api/v1/messages/inquiries");
  });

  await test("Checkout message to host is wired into booking creation", () => {
    const bookingServicePath = path.resolve(__dirname, "../services/booking.service.ts");
    const content = fs.readFileSync(bookingServicePath, "utf-8");
    assert(
      content.includes("messagingService.getOrCreateBookingConversation"),
      "Booking creation must call getOrCreateBookingConversation",
    );
    assert(
      content.includes("messageContent: input.message"),
      "Booking creation must persist input.message into conversation",
    );
  });

  // --- [2] Database & Service Lifecycle Tests ---
  console.log("\n--- [2] Live DB & Messaging Service Tests ---");

  // Create temporary test users and listing
  const suffix = Date.now().toString().slice(-6);
  const guestUser = await prisma.user.create({
    data: {
      email: `test_guest_${suffix}@homyz.io`,
      name: `Guest Tester ${suffix}`,
      role: Role.USER,
    },
  });

  const hostUser = await prisma.user.create({
    data: {
      email: `test_host_${suffix}@homyz.io`,
      name: `Host Tester ${suffix}`,
      role: Role.HOST,
    },
  });

  const thirdPartyUser = await prisma.user.create({
    data: {
      email: `test_thirdparty_${suffix}@homyz.io`,
      name: `Third Party ${suffix}`,
      role: Role.USER,
    },
  });

  const testListing = await prisma.listing.create({
    data: {
      hostId: hostUser.id,
      title: `Charming Seaside Villa ${suffix}`,
      description: "A lovely seaside villa for audit testing.",
      price: 15000, // SAR 150.00
      published: true,
      status: ListingStatus.ACTIVE,
      city: "Jeddah",
      country: "Saudi Arabia",
    },
  });

  const guestActor = { id: guestUser.id, role: Role.USER, email: guestUser.email, name: guestUser.name };
  const hostActor = { id: hostUser.id, role: Role.HOST, email: hostUser.email, name: hostUser.name };
  const thirdPartyActor = { id: thirdPartyUser.id, role: Role.USER, email: thirdPartyUser.email, name: thirdPartyUser.name };

  let testConversationId = "";
  let testOfferId = "";

  try {
    await test("1. Guest initiates pre-booking inquiry and creates Conversation", async () => {
      const res = await messagingService.createInquiryConversation(guestActor, {
        listingId: testListing.id,
        message: "Hello! Is late check-in possible?",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        guests: 2,
      });

      assert(res.conversation.id, "Conversation must have an ID");
      assert.strictEqual(res.conversation.guestId, guestUser.id);
      assert.strictEqual(res.conversation.hostId, hostUser.id);
      assert.strictEqual(res.conversation.listingId, testListing.id);
      assert.strictEqual(res.conversation.type, ConversationType.INQUIRY);
      assert.strictEqual(res.message.content, "Hello! Is late check-in possible?");
      assert.strictEqual(res.message.isOwn, true);

      testConversationId = res.conversation.id;
    });

    await test("2. Host cannot send inquiry to their own listing", async () => {
      let threw = false;
      try {
        await messagingService.createInquiryConversation(hostActor, {
          listingId: testListing.id,
          message: "Self inquiry",
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes("own listing"), "Must reject host inquiring on own listing");
      }
      assert(threw, "Expected error when host inquires on own listing");
    });

    await test("3. Host replies in conversation and unread count increases for guest", async () => {
      const reply = await messagingService.sendMessage(hostActor, testConversationId, {
        content: "Yes, late check-in via smartlock is available anytime after 3 PM.",
      });

      assert.strictEqual(reply.content, "Yes, late check-in via smartlock is available anytime after 3 PM.");
      assert.strictEqual(reply.isOwn, true);

      // Verify guest sees unread message
      const guestList = await messagingService.listConversationsForUser(guestActor, { role: "guest" });
      const guestConv = guestList.conversations.find((c) => c.id === testConversationId);
      assert(guestConv, "Guest must find conversation");
      assert.strictEqual(guestConv.unreadCount, 1, "Guest must have 1 unread message");
    });

    await test("4. Guest reads conversation and marks unread messages as read", async () => {
      const readRes = await messagingService.markConversationRead(guestActor, testConversationId);
      assert(readRes.markedRead >= 1, "At least 1 message should be marked read");

      const guestListAfter = await messagingService.listConversationsForUser(guestActor, { role: "guest" });
      const guestConvAfter = guestListAfter.conversations.find((c) => c.id === testConversationId);
      assert.strictEqual(guestConvAfter?.unreadCount, 0, "Unread count should be 0 after reading");
    });

    await test("5. Strict Authorization: Third-party cannot view or send messages (No IDOR)", async () => {
      let readBlocked = false;
      try {
        await messagingService.getConversationById(thirdPartyActor, testConversationId);
      } catch (err: any) {
        readBlocked = true;
        assert.strictEqual(err.status, 403);
      }
      assert(readBlocked, "Third-party read must be forbidden (403)");

      let sendBlocked = false;
      try {
        await messagingService.sendMessage(thirdPartyActor, testConversationId, {
          content: "Intruder message",
        });
      } catch (err: any) {
        sendBlocked = true;
        assert.strictEqual(err.status, 403);
      }
      assert(sendBlocked, "Third-party message sending must be forbidden (403)");
    });


    await test("6. Host pre-approves inquiry", async () => {
      const preApproved = await messagingService.preApproveInquiry(hostActor, testConversationId, {
        messageText: "You are pre-approved! Feel free to book.",
      });

      assert.strictEqual(preApproved.status, ConversationStatus.PRE_APPROVED);

      const msgs = await messagingService.getConversationMessages(guestActor, testConversationId);
      const preAppMsg = msgs.messages.find((m) => m.type === MessageType.PRE_APPROVAL);
      assert(preAppMsg, "Pre-approval message must exist in thread");
      assert(preAppMsg.content.includes("pre-approved"), "Message content must reflect pre-approval");
    });

    await test("7. Host sends Special Offer", async () => {
      const offerRes = await messagingService.sendSpecialOffer(hostActor, testConversationId, {
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        guests: 2,
        subtotalPrice: 48000, // SAR 480.00
        currency: "SAR",
        messageText: "Special discounted offer for your stay!",
      });

      assert(offerRes.specialOffer.id, "Special offer must have ID");
      assert.strictEqual(offerRes.specialOffer.status, SpecialOfferStatus.PENDING);
      assert.strictEqual(offerRes.specialOffer.subtotalPrice, 48000);
      assert.strictEqual(offerRes.message.type, MessageType.SPECIAL_OFFER);

      testOfferId = offerRes.specialOffer.id;
    });

    await test("8. Guest accepts Special Offer and receives valid checkout URL", async () => {
      const acceptRes = await messagingService.acceptSpecialOffer(guestActor, testConversationId, testOfferId);
      assert.strictEqual(acceptRes.specialOffer.status, SpecialOfferStatus.ACCEPTED);
      assert(acceptRes.checkoutUrl.includes(`/book/${testListing.id}`), "Checkout URL must target listing book page");
      assert(acceptRes.checkoutUrl.includes(`specialOfferId=${testOfferId}`), "Checkout URL must include special offer ID");

      const conv = await messagingService.getConversationById(guestActor, testConversationId);
      assert.strictEqual(conv.status, ConversationStatus.ACTIVE);
    });

    let testBookingId = "";

    await test("9. Request to Book checkout message is persisted into conversation", async () => {
      const testBooking = await prisma.booking.create({
        data: {
          userId: guestUser.id,
          listingId: testListing.id,
          startDate: new Date("2026-11-01"),
          endDate: new Date("2026-11-05"),
          guests: 2,
          totalPrice: 60000,
          status: BookingStatus.PENDING,
        },
      });
      testBookingId = testBooking.id;

      const checkoutRes = await messagingService.getOrCreateBookingConversation({
        guestId: guestUser.id,
        hostId: hostUser.id,
        listingId: testListing.id,
        bookingId: testBookingId,
        messageContent: "We will be arriving around 6 PM after our flight.",
        isConfirmed: false,
      });

      assert.strictEqual(checkoutRes.conversationId, testConversationId);
      assert(checkoutRes.messageId, "Message must have been created from checkout message");

      const msgs = await messagingService.getConversationMessages(hostActor, testConversationId);
      const checkoutMsg = msgs.messages.find((m) => m.id === checkoutRes.messageId);
      assert(checkoutMsg, "Checkout message must be present in conversation messages");
      assert.strictEqual(checkoutMsg.type, MessageType.BOOKING_REQUEST);
      assert.strictEqual(checkoutMsg.content, "We will be arriving around 6 PM after our flight.");
    });

    await test("10. Booking status change syncs into conversation thread", async () => {
      await messagingService.recordBookingStatusMessage({
        bookingId: testBookingId,
        statusText: "Host approved your booking request. Your reservation is confirmed!",
        newBookingStatus: BookingStatus.CONFIRMED,
        conversationStatus: ConversationStatus.CONFIRMED,
      });

      const conv = await messagingService.getConversationById(guestActor, testConversationId);
      assert.strictEqual(conv.status, ConversationStatus.CONFIRMED);

      const msgs = await messagingService.getConversationMessages(guestActor, testConversationId);
      const statusMsg = msgs.messages.find((m) => m.type === MessageType.BOOKING_STATUS);
      assert(statusMsg, "Booking status message must exist in thread");
      assert(statusMsg.content.includes("Host approved"), "Message text must reflect approval");
    });

    await test("11. Booking cancellation syncs into conversation thread", async () => {
      await messagingService.recordBookingStatusMessage({
        bookingId: testBookingId,
        statusText: "Guest cancelled this reservation.",
        newBookingStatus: BookingStatus.CANCELLED,
        conversationStatus: ConversationStatus.CANCELLED,
      });

      const conv = await messagingService.getConversationById(guestActor, testConversationId);
      assert.strictEqual(conv.status, ConversationStatus.CANCELLED);
    });


    await test("12. Host declines inquiry with reason", async () => {
      const declined = await messagingService.declineInquiry(hostActor, testConversationId, {
        reason: "Dates not available",
        messageText: "Sorry, the property is being repainted on these dates.",
      });

      assert.strictEqual(declined.status, ConversationStatus.DECLINED);

      const msgs = await messagingService.getConversationMessages(guestActor, testConversationId);
      const declineMsg = msgs.messages.find((m) => m.type === MessageType.DECLINE);
      assert(declineMsg, "Decline message must exist in thread");
      assert(declineMsg.content.includes("repainted"), "Decline note must be stored in message");
    });

    await test("13. Search and unread filters work accurately", async () => {
      const searchRes = await messagingService.listConversationsForUser(hostActor, {
        role: "host",
        search: "Seaside Villa",
      });
      assert(searchRes.conversations.length >= 1, "Search by listing title must find conversation");

      const noMatch = await messagingService.listConversationsForUser(hostActor, {
        role: "host",
        search: "Nonexistent Title XYZ 999",
      });
      assert.strictEqual(noMatch.conversations.length, 0, "Non-matching search must return empty");
    });

  } finally {
    // Cleanup test data
    try {
      await prisma.specialOffer.deleteMany({ where: { conversationId: testConversationId } });
      await prisma.message.deleteMany({ where: { conversationId: testConversationId } });
      await prisma.conversation.deleteMany({ where: { id: testConversationId } });
      await prisma.booking.deleteMany({ where: { listingId: testListing.id } });
      await prisma.listing.deleteMany({ where: { id: testListing.id } });

      await prisma.user.deleteMany({
        where: { id: { in: [guestUser.id, hostUser.id, thirdPartyUser.id] } },
      });
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
  }

  console.log("\n==================================================================");
  console.log(`   TEST MATRIX RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMessagingLifecycleMasterSuite().catch((err) => {
  console.error("Master test execution failed:", err);
  process.exit(1);
});
