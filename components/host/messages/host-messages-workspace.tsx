"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { bookingDateKey, formatBookingDateRange } from "@/lib/booking/booking-date";
import type {
  ConversationDTO,
  MessageDTO,
  SpecialOfferDTO,
  MessageAttachmentDTO,
} from "@/services/messaging.service";

type StagedAttachment = {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  fileSize: number;
  fileType: "IMAGE" | "DOCUMENT";
  mimeType: string;
  status: "UPLOADING" | "UPLOADED" | "FAILED";
  serverAttachmentId?: string;
  error?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMessagePreview(lastMessage?: MessageDTO | null): string {
  if (!lastMessage) return "No messages yet";
  if (lastMessage.content && lastMessage.content.trim()) {
    return lastMessage.content;
  }
  if (lastMessage.attachments && lastMessage.attachments.length > 0) {
    const hasImage = lastMessage.attachments.some((a) => a.fileType === "IMAGE");
    if (hasImage) {
      return lastMessage.attachments.length > 1 ? "Sent photos" : "Sent a photo";
    }
    return lastMessage.attachments.length > 1 ? "Sent files" : "Sent a file";
  }
  return "Sent an attachment";
}

interface HostMessagesWorkspaceProps {
  initialConversationId?: string;
}

export function HostMessagesWorkspace({ initialConversationId }: HostMessagesWorkspaceProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeIdFromQuery = searchParams.get("id") || initialConversationId || null;

  // Conversations state
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(activeIdFromQuery);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  // Messages state
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // Attachments state
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const [lightboxAttachment, setLightboxAttachment] = useState<MessageAttachmentDTO | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [specialOfferModalOpen, setSpecialOfferModalOpen] = useState(false);
  const [preApproveModalOpen, setPreApproveModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);

  // Form states for modals
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerEndDate, setOfferEndDate] = useState("");
  const [offerGuests, setOfferGuests] = useState(1);
  const [offerSubtotal, setOfferSubtotal] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [preApproveNote, setPreApproveNote] = useState("");
  const [declineReason, setDeclineReason] = useState("Dates not available");
  const [declineNote, setDeclineNote] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevMessagesCountRef = useRef(0);
  const lastScrolledConvIdRef = useRef<string | null>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  }, []);

  const handleContainerScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceFromBottom <= 100;
    isNearBottomRef.current = near;
    setIsNearBottom((prev) => (prev !== near ? near : prev));
  }, []);

  // Sync selectedId with query param
  useEffect(() => {
    if (activeIdFromQuery && activeIdFromQuery !== selectedId) {
      setSelectedId(activeIdFromQuery);
      lastScrolledConvIdRef.current = null;
    }
  }, [activeIdFromQuery, selectedId]);

  // Fetch conversations list
  const fetchConversations = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingConversations(true);
      const params = new URLSearchParams();
      params.set("role", "host");
      if (filter === "unread") params.set("filter", "unread");
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/v1/messages/conversations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const json = await res.json();
      if (json.success && Array.isArray(json.data.conversations)) {
        const incomingConvs: ConversationDTO[] = json.data.conversations;
        setConversations((prev) => {
          if (prev.length === incomingConvs.length) {
            let isSame = true;
            for (let i = 0; i < prev.length; i++) {
              const p = prev[i];
              const n = incomingConvs[i];
              if (
                p.id !== n.id ||
                p.unreadCount !== n.unreadCount ||
                p.lastMessageAt !== n.lastMessageAt ||
                p.status !== n.status ||
                p.lastMessage?.id !== n.lastMessage?.id
              ) {
                isSame = false;
                break;
              }
            }
            if (isSame) return prev;
          }
          return incomingConvs;
        });

        // Default to first conversation if none selected
        if (!selectedId && incomingConvs.length > 0) {
          setSelectedId(incomingConvs[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      if (!isBackground) setLoadingConversations(false);
    }
  }, [filter, search, selectedId]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (convId: string, isBackground = false) => {
    try {
      if (!isBackground) setLoadingMessages(true);
      const res = await fetch(`/api/v1/messages/conversations/${convId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const json = await res.json();
      if (json.success && Array.isArray(json.data.messages)) {
        const incoming: MessageDTO[] = json.data.messages;
        setMessages((prev) => {
          if (prev.length === incoming.length) {
            let isSame = true;
            for (let i = 0; i < prev.length; i++) {
              const p = prev[i];
              const n = incoming[i];
              if (
                p.id !== n.id ||
                p.readAt !== n.readAt ||
                p.content !== n.content ||
                p.type !== n.type ||
                p.createdAt !== n.createdAt ||
                (p.attachments?.length || 0) !== (n.attachments?.length || 0)
              ) {
                isSame = false;
                break;
              }
            }
            if (isSame) return prev;
          }
          return incoming;
        });
      }

      // Mark read only when needed
      if (!isBackground) {
        await fetch(`/api/v1/messages/conversations/${convId}/read`, { method: "POST" });
        setConversations((prev) => {
          const target = prev.find((c) => c.id === convId);
          if (!target || target.unreadCount === 0) return prev;
          return prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c));
        });
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      if (!isBackground) setLoadingMessages(false);
    }
  }, []);

  // Initial and reactive fetch for conversations
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // When selected conversation changes
  useEffect(() => {
    // Revoke any staged preview URLs
    stagedAttachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setStagedAttachments([]);

    if (selectedId) {
      lastScrolledConvIdRef.current = null;
      fetchMessages(selectedId);
      // Pre-populate modal dates if available from conversation
      const conv = conversations.find((c) => c.id === selectedId);
      if (conv?.booking) {
        setOfferStartDate(bookingDateKey(conv.booking.startDate));
        setOfferEndDate(bookingDateKey(conv.booking.endDate));
        setOfferGuests(conv.booking.guests || 1);
        if (conv.booking.totalPrice) {
          setOfferSubtotal((conv.booking.totalPrice / 100).toFixed(0));
        }
      } else {
        const today = new Date();
        const tomorrow = new Date(Date.now() + 86400000);
        setOfferStartDate(today.toISOString().split("T")[0]);
        setOfferEndDate(tomorrow.toISOString().split("T")[0]);
      }
    } else {
      setMessages([]);
    }
  }, [selectedId]);

  // Smart container scroll effect:
  // - On initial conversation load: instantly scrolls to bottom
  // - On user sending message: smoothly scrolls to bottom
  // - On incoming message from other party: only scrolls if user is ALREADY at bottom
  // - When user scrolls up: NEVER scrolls down!
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || loadingMessages || messages.length === 0) {
      prevMessagesCountRef.current = messages.length;
      return;
    }

    const isNewConversation = lastScrolledConvIdRef.current !== selectedId;
    const prevCount = prevMessagesCountRef.current;
    const newCount = messages.length;
    const latestMessage = messages[messages.length - 1];

    if (isNewConversation) {
      lastScrolledConvIdRef.current = selectedId;
      isNearBottomRef.current = true;
      setIsNearBottom(true);
      requestAnimationFrame(() => {
        scrollToBottom("auto");
        setTimeout(() => scrollToBottom("auto"), 50);
      });
    } else if (newCount > prevCount) {
      const isOwnMessage = Boolean(latestMessage?.isOwn);
      if (isOwnMessage || isNearBottomRef.current) {
        isNearBottomRef.current = true;
        setIsNearBottom(true);
        requestAnimationFrame(() => {
          scrollToBottom("smooth");
        });
      }
    }

    prevMessagesCountRef.current = newCount;
  }, [messages, selectedId, loadingMessages, scrollToBottom]);

  // Background polling (every 4 seconds when tab is active and visible)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchConversations(true);
        if (selectedId) {
          fetchMessages(selectedId, true);
        }
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [selectedId, fetchConversations, fetchMessages]);

  // Handle select conversation
  const handleSelectConversation = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setMobileView("thread");
    lastScrolledConvIdRef.current = null;
    router.replace(`/host/messages?id=${id}`, { scroll: false });
  };

  // Handle file attachment selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedId) return;

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const maxSizeBytes = 15 * 1024 * 1024; // 15MB

    const newItems: StagedAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      const dotIndex = lowerName.lastIndexOf(".");
      const ext = dotIndex !== -1 ? lowerName.slice(dotIndex) : "";
      const isPdf = file.type === "application/pdf" || ext === ".pdf";
      const isAllowed = allowedMimes.includes(file.type) || allowedExts.includes(ext);

      if (!isAllowed) {
        alert(`"${file.name}" is not supported. Please select JPG, PNG, WEBP images or PDF documents.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        alert(`"${file.name}" exceeds the 15MB file size limit.`);
        continue;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const previewUrl = !isPdf ? URL.createObjectURL(file) : "";

      newItems.push({
        id: tempId,
        file,
        previewUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: isPdf ? "DOCUMENT" : "IMAGE",
        mimeType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
        status: "UPLOADING",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (newItems.length === 0) return;

    setStagedAttachments((prev) => [...prev, ...newItems]);

    // Upload files sequentially/concurrently
    for (const item of newItems) {
      const formData = new FormData();
      formData.append("file", item.file);

      try {
        const res = await fetch(`/api/v1/messages/conversations/${selectedId}/attachments`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error?.message || "Upload failed");
        }

        const json = await res.json();
        const uploadedData = json.data;

        setStagedAttachments((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, status: "UPLOADED", serverAttachmentId: uploadedData.id }
              : s
          )
        );
      } catch (err: any) {
        console.error("Attachment upload error:", err);
        setStagedAttachments((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, status: "FAILED", error: err.message || "Upload failed" }
              : s
          )
        );
      }
    }
  };

  // Remove staged attachment
  const handleRemoveStagedAttachment = async (stagedId: string) => {
    const item = stagedAttachments.find((s) => s.id === stagedId);
    if (!item) return;

    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }

    setStagedAttachments((prev) => prev.filter((s) => s.id !== stagedId));

    if (item.serverAttachmentId && selectedId) {
      try {
        await fetch(
          `/api/v1/messages/conversations/${selectedId}/attachments/${item.serverAttachmentId}`,
          { method: "DELETE" }
        );
      } catch (err) {
        console.warn("Failed to delete staged attachment on server:", err);
      }
    }
  };

  // Send a message (text, attachment, or both)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const uploaded = stagedAttachments.filter((a) => a.status === "UPLOADED" && a.serverAttachmentId);
    const text = inputText.trim();

    if (!selectedId || (!text && uploaded.length === 0) || sending) return;

    const attachmentIds = uploaded.map((a) => a.serverAttachmentId!);
    const optimisticAttachments: MessageAttachmentDTO[] = uploaded.map((a) => ({
      id: a.serverAttachmentId!,
      conversationId: selectedId,
      messageId: null,
      fileName: a.fileName,
      fileType: a.fileType,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      fileUrl: a.previewUrl || `/api/v1/messages/attachments/${a.serverAttachmentId}`,
      createdAt: new Date().toISOString(),
    }));

    setInputText("");
    setStagedAttachments([]);
    setSending(true);
    isNearBottomRef.current = true;
    setIsNearBottom(true);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageDTO = {
      id: tempId,
      conversationId: selectedId,
      senderId: "current-user",
      type: "TEXT" as any,
      content: text,
      readAt: null,
      metadata: null,
      createdAt: new Date().toISOString(),
      isOwn: true,
      attachments: optimisticAttachments,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    requestAnimationFrame(() => scrollToBottom("smooth"));

    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const json = await res.json();
      if (json.success && json.data) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? json.data : m)));
        fetchConversations(true);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Pre-approve inquiry
  const handlePreApprove = async () => {
    if (!selectedId || modalSubmitting) return;
    setModalSubmitting(true);
    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedId}/pre-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageText: preApproveNote.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Pre-approval failed");
      setPreApproveModalOpen(false);
      setPreApproveNote("");
      await fetchMessages(selectedId);
      await fetchConversations(true);
    } catch (err) {
      console.error("Pre-approval error:", err);
      alert("Failed to pre-approve inquiry.");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Send special offer
  const handleSendSpecialOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || modalSubmitting) return;

    const subtotal = Math.round(parseFloat(offerSubtotal) * 100);
    if (isNaN(subtotal) || subtotal <= 0) {
      alert("Please enter a valid subtotal amount.");
      return;
    }

    setModalSubmitting(true);
    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedId}/special-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: offerStartDate,
          endDate: offerEndDate,
          guests: offerGuests,
          subtotalPrice: subtotal,
          messageText: offerNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Special offer failed");
      setSpecialOfferModalOpen(false);
      setOfferNote("");
      await fetchMessages(selectedId);
      await fetchConversations(true);
    } catch (err) {
      console.error("Special offer error:", err);
      alert("Failed to send special offer.");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Decline inquiry
  const handleDecline = async () => {
    if (!selectedId || modalSubmitting) return;
    setModalSubmitting(true);
    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: declineReason,
          messageText: declineNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Decline failed");
      setDeclineModalOpen(false);
      setDeclineNote("");
      await fetchMessages(selectedId);
      await fetchConversations(true);
    } catch (err) {
      console.error("Decline error:", err);
      alert("Failed to decline inquiry.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const formatListDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getStatusBadge = (status: string, activeOffer?: any) => {
    if (activeOffer && status !== "CONFIRMED" && status !== "CANCELLED" && status !== "COMPLETED") {
      if (activeOffer.status === "ACCEPTED") {
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
            Offer accepted
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
          Special offer sent
        </span>
      );
    }
    switch (status) {
      case "PRE_APPROVED":
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">Pre-approved</span>;
      case "SPECIAL_OFFER_SENT":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">Special offer sent</span>;
      case "CONFIRMED":
        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 border border-emerald-300">Confirmed stay</span>;
      case "DECLINED":
        return <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 border border-zinc-200">Declined</span>;
      case "CANCELLED":
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">Inquiry</span>;
    }
  };

  return (
    <div className="messages-workspace flex-1 w-full max-w-[1520px] mx-auto px-0 sm:px-5 lg:px-0 py-0 lg:py-4">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_340px] xl:grid-cols-[380px_1fr_360px] gap-6 h-[calc(100vh-210px)] min-h-[640px]">
        {/* ========================================================================= */}
        {/* COLUMN 1: CONVERSATIONS LIST                                              */}
        {/* ========================================================================= */}
        <div className={`flex flex-col bg-white overflow-hidden lg:border-r lg:border-zinc-200 ${mobileView === "thread" ? "hidden lg:flex" : "flex"}`}>
          {/* Header & Tabs */}
          <div className="p-4 border-b border-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <h1>Messages</h1>
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Filter Pills */}
            <div className="messages-filters flex gap-2">
              <div className="relative">
                <button type="button" onClick={() => setFilterMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={filterMenuOpen} className="inline-flex h-[45px] min-w-[77px] items-center justify-center gap-1.5 rounded-[30px] border border-[#777] bg-[#FCDF9C] px-4 text-base font-medium text-[#1F1F1F] transition-colors">
                  All
                  <svg className={`size-3.5 transition-transform ${filterMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {filterMenuOpen && (
                  <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[132px] overflow-hidden rounded-2xl border border-zinc-300 bg-white p-1 shadow-lg">
                    <button type="button" role="menuitem" onClick={() => { setFilter("all"); setFilterMenuOpen(false); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100">All messages</button>
                    <button type="button" role="menuitem" onClick={() => { setFilter("unread"); setFilterMenuOpen(false); }} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100">Unread</button>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setFilter("unread"); setFilterMenuOpen(false); }} className="inline-flex h-[45px] min-w-[93px] items-center justify-center rounded-[30px] border border-[#777] bg-white px-4 text-base font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50"><span>Unread</span></button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guest or listing..."
                className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm bg-zinc-50 border border-zinc-200 rounded-full focus:outline-none focus:border-zinc-400 focus:bg-white transition-colors"
              />
              <svg
                className="absolute left-3 top-2.5 size-4 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {loadingConversations ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="size-12 rounded-full bg-zinc-200 shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3.5 bg-zinc-200 rounded w-1/2" />
                      <div className="h-3 bg-zinc-100 rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 space-y-2">
                <svg
                  className="mx-auto size-10 text-zinc-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm font-medium text-zinc-600">No messages found</p>
                <p className="text-xs">Guest inquiries and booking messages will appear here.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedId;
                const hasUnread = conv.unreadCount > 0;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left p-3.5 sm:p-4 flex gap-3 transition-colors ${
                      isSelected
                        ? "bg-amber-50/70 border-l-4 border-amber-400"
                        : "hover:bg-zinc-50/80"
                    }`}
                  >
                    {/* Guest Avatar */}
                    <div className="relative shrink-0">
                      {conv.guest.image ? (
                        <Image
                          src={conv.guest.image}
                          alt={conv.guest.name || "Guest"}
                          width={40}
                          height={40}
                          className="size-10 rounded-full object-cover border border-zinc-200"
                        />
                      ) : (
                        <div className="size-10 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-base border border-amber-300">
                          {(conv.guest.name || "G")[0].toUpperCase()}
                        </div>
                      )}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-[#1F1F1F]" : "font-semibold text-zinc-800"}`}>
                          {conv.guest.name || "Guest"}
                        </span>
                        <span className="text-[11px] text-zinc-400 shrink-0">
                          {formatListDate(conv.lastMessageAt)}
                        </span>
                      </div>

                      <p className="hidden">
                        {conv.listing.title}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-[13px] leading-[18px] `}>
                          {getMessagePreview(conv.lastMessage)}
                        </p>
                        <span className="shrink-0">{getStatusBadge(conv.status, conv.activeSpecialOffer)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: ACTIVE CHAT THREAD                                              */}
        {/* ========================================================================= */}
        <div className={`flex flex-col bg-white overflow-hidden min-w-0 ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
          {selectedConversation ? (
            <>
              {/* Thread Top Bar */}
              <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  <button type="button" onClick={() => setMobileView("list")} className="lg:hidden -ml-1 size-9 rounded-full border border-zinc-200 text-lg" aria-label="Back to messages">‹</button>
                  {selectedConversation.guest.image ? (
                    <Image
                      src={selectedConversation.guest.image}
                      alt={selectedConversation.guest.name || "Guest"}
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-cover border border-zinc-200"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-sm">
                      {(selectedConversation.guest.name || "G")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#1F1F1F] truncate">
                      {selectedConversation.guest.name || "Guest"}
                    </h3>
                    <p className="text-xs text-zinc-500 truncate">
                      {selectedConversation.listing.title}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons (Pre-approve, Special offer, Decline) */}
                <div className="flex items-center gap-2">
                  {selectedConversation.status !== "CONFIRMED" && selectedConversation.status !== "DECLINED" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreApproveModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        Pre-approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpecialOfferModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FCDF9C] text-[#1F1F1F] hover:bg-[#F7D37D] transition-colors"
                      >
                        Special offer
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclineModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-zinc-600 hover:bg-zinc-100 border border-zinc-200 transition-colors"
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                  ref={messagesContainerRef}
                  onScroll={handleContainerScroll}
                  className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-zinc-50/20"
                >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-xs text-zinc-400">
                    Loading conversation...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 space-y-2">
                    <p className="text-sm font-medium text-zinc-600">Start the conversation</p>
                    <p className="text-xs">Send a welcome message or answer the guest&apos;s questions.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isHost = m.isOwn;

                    // Special Offer Card
                    if (m.type === "SPECIAL_OFFER") {
                      const offerId = (m.metadata?.specialOfferId as string) || "";
                      const matchingOffer = selectedConversation.specialOffers?.find((so) => so.id === offerId);
                      const isExpired =
                        matchingOffer?.status === "EXPIRED" ||
                        Boolean(matchingOffer?.expiresAt && new Date(matchingOffer.expiresAt) < new Date());
                      const isDeclined = matchingOffer?.status === "DECLINED";
                      const isAccepted = matchingOffer?.status === "ACCEPTED" || messages.some((msg) => msg.type === "SYSTEM" && msg.metadata?.specialOfferId === offerId);
                      const hasBooking = Boolean(
                        selectedConversation.bookingId &&
                        selectedConversation.booking &&
                        selectedConversation.booking.status !== "CANCELLED"
                      );

                      return (
                        <div key={m.id} className="flex justify-center my-3">
                          <div className="max-w-md w-full rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                                  Special Offer Sent
                                </span>
                                {hasBooking ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300">
                                    Booked & Confirmed
                                  </span>
                                ) : isExpired ? (
                                  <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 border border-zinc-300">
                                    Expired
                                  </span>
                                ) : isDeclined ? (
                                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                                    Declined
                                  </span>
                                ) : isAccepted ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300">
                                    Accepted by Guest
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-300">
                                    Sent (Awaiting Guest)
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-500">{formatMessageTime(m.createdAt)}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-800 font-medium">{m.content}</p>
                            {m.metadata && (
                              <div className="grid grid-cols-2 gap-2 text-xs bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                                <div>
                                  <span className="text-zinc-500 block">Dates:</span>
                                  <span className="font-semibold text-zinc-800">
                                    {formatBookingDateRange(
                                      String(m.metadata.startDate || ""),
                                      String(m.metadata.endDate || ""),
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block">Total Offer:</span>
                                  <span className="font-bold text-amber-900 text-sm">
                                    {String(m.metadata.currency || "SAR")} {((Number(m.metadata.subtotalPrice) || 0) / 100).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Pre-approval Notice
                    if (m.type === "PRE_APPROVAL") {
                      return (
                        <div key={m.id} className="flex justify-center my-3">
                          <div className="max-w-md w-full rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 shadow-2xs text-center space-y-1">
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                              Inquiry Pre-Approved
                            </span>
                            <p className="text-xs sm:text-sm text-emerald-950">{m.content}</p>
                            <span className="text-[10px] text-emerald-700 block">{formatMessageTime(m.createdAt)}</span>
                          </div>
                        </div>
                      );
                    }

                    // Decline Notice
                    if (m.type === "DECLINE") {
                      return (
                        <div key={m.id} className="flex justify-center my-3">
                          <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-zinc-100 p-3.5 shadow-2xs text-center space-y-1">
                            <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                              Inquiry Declined
                            </span>
                            <p className="text-xs sm:text-sm text-zinc-700">{m.content}</p>
                            <span className="text-[10px] text-zinc-400 block">{formatMessageTime(m.createdAt)}</span>
                          </div>
                        </div>
                      );
                    }

                    // System / Status Message
                    if (m.type === "SYSTEM" || m.type === "BOOKING_STATUS") {
                      return (
                        <div key={m.id} className="flex justify-center my-2">
                          <div className="rounded-full bg-zinc-100 border border-zinc-200 px-4 py-1 text-xs text-zinc-600 font-medium">
                            {m.content} • {formatMessageTime(m.createdAt)}
                          </div>
                        </div>
                      );
                    }

                    // Standard Chat Bubble
                    const hasAttachments = m.attachments && m.attachments.length > 0;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isHost ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs space-y-2 ${
                            isHost
                              ? "bg-[#1F1F1F] text-white rounded-br-xs"
                              : "bg-white border border-zinc-200/80 text-zinc-800 rounded-bl-xs"
                          }`}
                        >
                          {m.type === "BOOKING_REQUEST" && (
                            <div className="pb-1.5 border-b border-white/20 text-[11px] font-semibold text-amber-200">
                              Booking Request Note
                            </div>
                          )}

                          {/* Render Attachments if present */}
                          {hasAttachments && (
                            <div className="space-y-2">
                              {/* Image attachments */}
                              {m.attachments!.filter((a) => a.fileType === "IMAGE").length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {m.attachments!
                                    .filter((a) => a.fileType === "IMAGE")
                                    .map((att) => (
                                      <button
                                        key={att.id}
                                        type="button"
                                        onClick={() => setLightboxAttachment(att)}
                                        className="relative group block overflow-hidden rounded-xl bg-black/10 border border-black/5 hover:opacity-95 transition-opacity text-left"
                                        title="Click to view full image"
                                      >
                                        <img
                                          src={att.fileUrl}
                                          alt={att.fileName}
                                          loading="lazy"
                                          className="w-full h-44 object-cover rounded-xl"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                          <svg className="size-6 drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                          </svg>
                                        </div>
                                      </button>
                                    ))}
                                </div>
                              )}

                              {/* Document attachments */}
                              {m.attachments!.filter((a) => a.fileType === "DOCUMENT").map((att) => (
                                <div
                                  key={att.id}
                                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                                    isHost
                                      ? "bg-white/10 border-white/15 text-white"
                                      : "bg-zinc-50 border-zinc-200 text-zinc-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="size-9 rounded-lg bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate max-w-[180px] sm:max-w-xs">{att.fileName}</p>
                                      <p className={`text-[10px] ${isHost ? "text-zinc-300" : "text-zinc-500"}`}>{formatFileSize(att.fileSize)} • PDF Document</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <a
                                      href={att.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                                        isHost
                                          ? "bg-white/20 hover:bg-white/30 text-white"
                                          : "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                                      }`}
                                    >
                                      Open
                                    </a>
                                    <a
                                      href={`${att.fileUrl}?download=true`}
                                      download={att.fileName}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        isHost
                                          ? "bg-white/20 hover:bg-white/30 text-white"
                                          : "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                                      }`}
                                      title="Download document"
                                    >
                                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {m.content && (
                            <p className="whitespace-pre-wrap break-words px-1.5">{m.content}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-400 px-1">
                          <span>{formatMessageTime(m.createdAt)}</span>
                          {isHost && (
                            <span>{m.readAt ? "• Read" : "• Sent"}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                </div>

                {/* Jump to latest button when user scrolled up */}
                {!isNearBottom && !loadingMessages && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      isNearBottomRef.current = true;
                      setIsNearBottom(true);
                      scrollToBottom("smooth");
                    }}
                    className="absolute bottom-3 right-5 z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-zinc-800 text-xs font-semibold shadow-md border border-zinc-200 hover:bg-zinc-50 hover:shadow-lg transition-all"
                  >
                    <svg className="size-3.5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>Jump to latest</span>
                  </button>
                )}
              </div>

              {/* Message Composer */}
              <div className="border-t border-zinc-100 bg-white p-3.5 sm:p-4 space-y-2">
                {/* Staged attachments preview */}
                {stagedAttachments.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {stagedAttachments.map((s) => (
                      <div
                        key={s.id}
                        className="relative shrink-0 flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
                      >
                        {s.fileType === "IMAGE" ? (
                          <div className="relative size-12 rounded-lg overflow-hidden bg-zinc-200">
                            {s.previewUrl && (
                              <img
                                src={s.previewUrl}
                                alt={s.fileName}
                                className="size-full object-cover"
                              />
                            )}
                            {s.status === "UPLOADING" && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              </div>
                            )}
                            {s.status === "FAILED" && (
                              <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center text-white text-[10px] font-bold">
                                !
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="size-12 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            {s.status === "UPLOADING" ? (
                              <svg className="size-5 animate-spin text-red-500" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            ) : (
                              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                        )}
                        <div className="min-w-0 max-w-[120px]">
                          <p className="text-xs font-medium text-zinc-700 truncate">{s.fileName}</p>
                          <p className="text-[10px] text-zinc-400">
                            {s.status === "UPLOADING"
                              ? "Uploading..."
                              : s.status === "FAILED"
                              ? "Failed"
                              : formatFileSize(s.fileSize)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedAttachment(s.id)}
                          className="size-5 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 flex items-center justify-center text-xs transition-colors shrink-0 ml-1"
                          title="Remove attachment"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  {/* Attachment button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="size-11 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 flex items-center justify-center transition-colors shrink-0"
                    title="Attach a photo or document"
                    aria-label="Attach a photo or document"
                  >
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="flex-1 relative">
                    <textarea
                      rows={2}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a message to the guest... (Press Enter to send)"
                      className="w-full resize-none p-3 text-xs sm:text-sm rounded-2xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:border-zinc-400 focus:bg-white transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      (!inputText.trim() && !stagedAttachments.some((a) => a.status === "UPLOADED")) ||
                      sending ||
                      stagedAttachments.some((a) => a.status === "UPLOADING")
                    }
                    className="h-11 px-5 rounded-2xl bg-[#1F1F1F] text-white text-xs sm:text-sm font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <span>Send</span>
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 space-y-3">
              <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-zinc-700">Select a conversation</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                Choose a guest from the left panel to review inquiries, send special offers, or respond to booking messages.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: CONTEXT & RESERVATION PANEL                                     */}
        {/* ========================================================================= */}
        <div className="hidden lg:flex flex-col gap-4 overflow-y-auto">
          {selectedConversation ? (
            <>
              {/* Listing Card */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Listing</h4>
                <div className="flex gap-3 items-center">
                  {selectedConversation.listing.photos[0] ? (
                    <Image
                      src={selectedConversation.listing.photos[0]}
                      alt={selectedConversation.listing.title}
                      width={64}
                      height={64}
                      className="size-16 rounded-2xl object-cover shrink-0 border border-zinc-200"
                    />
                  ) : (
                    <div className="size-16 rounded-2xl bg-zinc-100 shrink-0 border border-zinc-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1F1F1F] truncate">
                      {selectedConversation.listing.title}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {[selectedConversation.listing.city, selectedConversation.listing.country].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-xs font-semibold text-zinc-800 mt-1">
                      SAR {(selectedConversation.listing.price / 100).toFixed(0)} <span className="font-normal text-zinc-500">/ night</span>
                    </p>
                  </div>
                </div>
                <Link
                  href={`/listings/${selectedConversation.listing.id}`}
                  target="_blank"
                  className="block text-center w-full py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  View Listing
                </Link>
              </div>

              {/* Guest Profile Card */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">About the Guest</h4>
                <div className="flex items-center gap-3">
                  {selectedConversation.guest.image ? (
                    <Image
                      src={selectedConversation.guest.image}
                      alt={selectedConversation.guest.name || "Guest"}
                      width={48}
                      height={48}
                      className="size-12 rounded-full object-cover border border-zinc-200"
                    />
                  ) : (
                    <div className="size-12 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-sm">
                      {(selectedConversation.guest.name || "G")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1F1F1F] truncate">
                      {selectedConversation.guest.name || "Guest"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Member since {new Date(selectedConversation.guest.createdAt).getFullYear()}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-100 text-xs text-zinc-600 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <svg className="size-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Identity confirmed</span>
                  </div>
                  {selectedConversation.guest.email && (
                    <div className="flex items-center gap-2">
                      <svg className="size-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Email verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reservation / Inquiry Details */}
              <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Stay Details</h4>
                  {getStatusBadge(selectedConversation.status, selectedConversation.activeSpecialOffer)}
                </div>

                {selectedConversation.booking ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Dates</span>
                      <span className="font-semibold text-zinc-800">
                        {formatBookingDateRange(selectedConversation.booking.startDate, selectedConversation.booking.endDate)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Guests</span>
                      <span className="font-semibold text-zinc-800">{selectedConversation.booking.guests}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-500">Total Price</span>
                      <span className="font-bold text-zinc-900 text-sm">
                        {selectedConversation.booking.currency} {((selectedConversation.booking.totalPrice || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    {selectedConversation.booking.cancellationPolicy && (
                      <div className="flex justify-between py-1">
                        <span className="text-zinc-500">Policy</span>
                        <span className="font-medium text-zinc-700 capitalize">
                          {selectedConversation.booking.cancellationPolicy.toLowerCase()}
                        </span>
                      </div>
                    )}
                    <Link
                      href={`/bookings/${selectedConversation.booking.id}`}
                      className="block text-center w-full mt-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-black transition-colors"
                    >
                      View Reservation Details
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs text-zinc-600">
                    <p>This is a pre-booking inquiry. The guest has not yet confirmed a reservation.</p>
                    <div className="pt-2 border-t border-zinc-100 space-y-2">
                      <button
                        type="button"
                        onClick={() => setSpecialOfferModalOpen(true)}
                        className="w-full py-2 rounded-xl bg-[#FCDF9C] text-[#1F1F1F] text-xs font-semibold hover:bg-[#F7D37D] transition-colors"
                      >
                        Send Special Offer
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreApproveModalOpen(true)}
                        className="w-full py-2 rounded-xl border border-zinc-300 text-zinc-800 text-xs font-semibold hover:bg-zinc-50 transition-colors"
                      >
                        Pre-approve Inquiry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-center text-xs text-zinc-400">
              Context and stay details will appear here.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SPECIAL OFFER                                                      */}
      {/* ========================================================================= */}
      {specialOfferModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-[#1F1F1F]">Send a Special Offer</h3>
              <button
                type="button"
                onClick={() => setSpecialOfferModalOpen(false)}
                className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendSpecialOffer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Check-in</label>
                  <input
                    type="date"
                    required
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Check-out</label>
                  <input
                    type="date"
                    required
                    value={offerEndDate}
                    onChange={(e) => setOfferEndDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Guests</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={offerGuests}
                    onChange={(e) => setOfferGuests(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Special Subtotal ({selectedConversation?.booking?.currency || "SAR"})
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    placeholder="e.g. 500"
                    value={offerSubtotal}
                    onChange={(e) => setOfferSubtotal(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Optional note to guest
                </label>
                <textarea
                  rows={2}
                  value={offerNote}
                  onChange={(e) => setOfferNote(e.target.value)}
                  placeholder="e.g. I gave you a 10% discount for the week!"
                  className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <p className="text-[11px] text-zinc-500">
                Special offers expire automatically after 24 hours. The guest can accept and book directly.
              </p>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSpecialOfferModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-6 py-2.5 rounded-full bg-[#1F1F1F] text-white text-xs font-semibold hover:bg-black disabled:opacity-50"
                >
                  {modalSubmitting ? "Sending..." : "Send Special Offer"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRE-APPROVE                                                        */}
      {/* ========================================================================= */}
      {preApproveModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[#1F1F1F]">Pre-approve Guest Inquiry</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Pre-approving lets {selectedConversation?.guest.name || "the guest"} book immediately without needing additional approval. The guest will receive a notification and has 24 hours to complete their reservation.
            </p>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Custom message (optional)
              </label>
              <textarea
                rows={3}
                value={preApproveNote}
                onChange={(e) => setPreApproveNote(e.target.value)}
                placeholder="Looking forward to hosting you! You can now book anytime."
                className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPreApproveModalOpen(false)}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSubmitting}
                onClick={handlePreApprove}
                className="px-6 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {modalSubmitting ? "Pre-approving..." : "Confirm Pre-approval"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DECLINE                                                            */}
      {/* ========================================================================= */}
      {declineModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[#1F1F1F]">Decline Inquiry</h3>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Reason</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none"
              >
                <option value="Dates not available">Dates not available</option>
                <option value="Listing not suitable">Listing not suitable for party</option>
                <option value="Maintenance / cleaning">Maintenance or repairs scheduled</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Note to guest (optional)
              </label>
              <textarea
                rows={2}
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                placeholder="Sorry, we won't be able to host you on these dates."
                className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-zinc-300 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeclineModalOpen(false)}
                className="px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSubmitting}
                onClick={handleDecline}
                className="px-6 py-2.5 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {modalSubmitting ? "Declining..." : "Decline Inquiry"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Image Lightbox Modal */}
      {lightboxAttachment && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs">
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full pb-3 text-white">
              <span className="text-sm font-medium truncate max-w-md">{lightboxAttachment.fileName}</span>
              <div className="flex items-center gap-2">
                <a
                  href={`${lightboxAttachment.fileUrl}?download=true`}
                  download={lightboxAttachment.fileName}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center gap-1.5"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxAttachment(null)}
                  className="size-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="relative flex items-center justify-center overflow-auto max-h-[80vh] w-full">
              <img
                src={lightboxAttachment.fileUrl}
                alt={lightboxAttachment.fileName}
                className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
