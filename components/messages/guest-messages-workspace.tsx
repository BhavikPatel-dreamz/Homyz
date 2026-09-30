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

interface GuestMessagesWorkspaceProps {
  initialConversationId?: string;
}

export function GuestMessagesWorkspace({ initialConversationId }: GuestMessagesWorkspaceProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeIdFromQuery = searchParams.get("id") || initialConversationId || null;

  // Conversations state
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(activeIdFromQuery);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");

  // Messages state
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [acceptingOffer, setAcceptingOffer] = useState(false);

  // Attachments state
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const [lightboxAttachment, setLightboxAttachment] = useState<MessageAttachmentDTO | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      params.set("role", "guest");
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

        if (!selectedId && incomingConvs.length > 0) {
          setSelectedId(incomingConvs[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching guest conversations:", err);
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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    // Revoke any staged preview URLs
    stagedAttachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setStagedAttachments([]);

    if (selectedId) {
      lastScrolledConvIdRef.current = null;
      fetchMessages(selectedId);
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

  // Background polling (every 4.5s)
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

  const handleSelectConversation = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    lastScrolledConvIdRef.current = null;
    router.replace(`/messages?id=${id}`, { scroll: false });
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
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(text);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Accept Special Offer & Navigate to Checkout
  const handleAcceptSpecialOffer = async (specialOfferId: string, fallbackCheckoutUrl?: string) => {
    if (!selectedId || acceptingOffer) return;
    setAcceptingOffer(true);
    try {
      const res = await fetch(`/api/v1/messages/conversations/${selectedId}/special-offer/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialOfferId }),
      });
      if (!res.ok) {
        if (fallbackCheckoutUrl) {
          router.push(fallbackCheckoutUrl);
          return;
        }
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || "Failed to process special offer");
      }
      const json = await res.json();
      if (json.success && json.data?.checkoutUrl) {
        router.push(json.data.checkoutUrl);
      } else if (fallbackCheckoutUrl) {
        router.push(fallbackCheckoutUrl);
      } else {
        await fetchMessages(selectedId);
        await fetchConversations(true);
      }
    } catch (err: any) {
      console.error("Error accepting special offer:", err);
      if (fallbackCheckoutUrl) {
        router.push(fallbackCheckoutUrl);
      } else {
        alert(err?.message || "Could not proceed with special offer. It may have expired.");
      }
    } finally {
      setAcceptingOffer(false);
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
          Special offer
        </span>
      );
    }
    switch (status) {
      case "PRE_APPROVED":
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">Pre-approved</span>;
      case "SPECIAL_OFFER_SENT":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">Special offer</span>;
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
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[380px_1fr] gap-6 h-[calc(100vh-190px)] min-h-[600px]">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CONVERSATIONS LIST                                           */}
        {/* ========================================================================= */}
        <div className="flex flex-col rounded-3xl border border-zinc-200/90 bg-white shadow-xs overflow-hidden">
          {/* Header & Tabs */}
          <div className="p-4 border-b border-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-[#1F1F1F]">Messages</h1>
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                {conversations.length}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === "all"
                    ? "bg-[#1F1F1F] text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === "unread"
                    ? "bg-[#1F1F1F] text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Unread
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages..."
                className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm bg-zinc-50 border border-zinc-200 rounded-full focus:outline-none focus:border-zinc-400 focus:bg-white transition-colors"
              />
              <svg
                className="absolute left-3 top-2.5 size-4 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {loadingConversations ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
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
                <p className="text-sm font-medium text-zinc-600">No conversations yet</p>
                <p className="text-xs">When you inquire about a stay or make a booking, messages with hosts will show up here.</p>
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
                    <div className="relative shrink-0">
                      {conv.host.image ? (
                        <Image
                          src={conv.host.image}
                          alt={conv.host.name || "Host"}
                          width={48}
                          height={48}
                          className="size-12 rounded-full object-cover border border-zinc-200"
                        />
                      ) : (
                        <div className="size-12 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-base">
                          {(conv.host.name || "H")[0].toUpperCase()}
                        </div>
                      )}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-[#1F1F1F]" : "font-semibold text-zinc-800"}`}>
                          {conv.host.name || "Host"}
                        </span>
                        <span className="text-[11px] text-zinc-400 shrink-0">
                          {formatListDate(conv.lastMessageAt)}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-zinc-600 truncate mb-1">
                        {conv.listing.title}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${hasUnread ? "font-semibold text-[#1F1F1F]" : "text-zinc-500"}`}>
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
        {/* RIGHT COLUMN: ACTIVE CHAT THREAD                                          */}
        {/* ========================================================================= */}
        <div className="flex flex-col rounded-3xl border border-zinc-200/90 bg-white shadow-xs overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-3 bg-zinc-50/50">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedConversation.host.image ? (
                    <Image
                      src={selectedConversation.host.image}
                      alt={selectedConversation.host.name || "Host"}
                      width={44}
                      height={44}
                      className="size-11 rounded-full object-cover border border-zinc-200"
                    />
                  ) : (
                    <div className="size-11 rounded-full bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-base">
                      {(selectedConversation.host.name || "H")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-[#1F1F1F] truncate">
                      Hosted by {selectedConversation.host.name || "Host"}
                    </h2>
                    <Link
                      href={`/listings/${selectedConversation.listing.id}`}
                      target="_blank"
                      className="text-xs text-zinc-600 hover:text-black underline truncate block"
                    >
                      {selectedConversation.listing.title}
                    </Link>
                  </div>
                </div>

                <div className="shrink-0">
                  {getStatusBadge(selectedConversation.status, selectedConversation.activeSpecialOffer)}
                </div>
              </div>

              {/* Pinned banner if there's an active or accepted special offer awaiting checkout */}
              {selectedConversation.activeSpecialOffer &&
                (!selectedConversation.bookingId || selectedConversation.booking?.status === "CANCELLED") && (
                  <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <span className="font-semibold text-amber-950 truncate">
                        Special Offer: {selectedConversation.activeSpecialOffer.currency}{" "}
                        {(selectedConversation.activeSpecialOffer.subtotalPrice / 100).toFixed(2)} (
                        {formatBookingDateRange(
                          selectedConversation.activeSpecialOffer.startDate,
                          selectedConversation.activeSpecialOffer.endDate,
                        )})
                      </span>
                      <span className="text-[11px] text-amber-800 shrink-0 hidden sm:inline">
                        • {selectedConversation.activeSpecialOffer.status === "ACCEPTED" ? "Accepted by you" : "Ready to accept"}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={acceptingOffer}
                      onClick={() => {
                        const start = bookingDateKey(selectedConversation.activeSpecialOffer!.startDate);
                        const end = bookingDateKey(selectedConversation.activeSpecialOffer!.endDate);
                        const guests = selectedConversation.activeSpecialOffer!.guests;
                        const fallbackUrl = `/book/${selectedConversation.listing.id}?checkIn=${encodeURIComponent(start)}&checkOut=${encodeURIComponent(end)}&guests=${guests}&specialOfferId=${encodeURIComponent(selectedConversation.activeSpecialOffer!.id)}`;
                        handleAcceptSpecialOffer(selectedConversation.activeSpecialOffer!.id, fallbackUrl);
                      }}
                      className="shrink-0 px-3.5 py-1 rounded-full bg-[#1F1F1F] text-white text-xs font-semibold hover:bg-black transition-colors shadow-2xs flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>
                        {selectedConversation.activeSpecialOffer.status === "ACCEPTED"
                          ? "Proceed to Checkout"
                          : "Accept & Book"}
                      </span>
                      <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                )}

              {/* Messages Area */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                  ref={messagesContainerRef}
                  onScroll={handleContainerScroll}
                  className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-zinc-50/20"
                >
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-xs text-zinc-400">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 space-y-2">
                    <p className="text-sm font-medium text-zinc-600">Send a message</p>
                    <p className="text-xs">Ask the host any questions about the place or your upcoming stay.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isGuest = m.isOwn;

                    // Special Offer Card
                    if (m.type === "SPECIAL_OFFER") {
                      const offerId = (m.metadata?.specialOfferId as string) || "";
                      const matchingOffer = selectedConversation.specialOffers?.find((so) => so.id === offerId);
                      const startDate = bookingDateKey(String(matchingOffer?.startDate || m.metadata?.startDate || ""));
                      const endDate = bookingDateKey(String(matchingOffer?.endDate || m.metadata?.endDate || ""));
                      const guestsCount = Number(matchingOffer?.guests || m.metadata?.guests || 1);
                      const currency = String(matchingOffer?.currency || m.metadata?.currency || "SAR");
                      const subtotalPrice = Number(matchingOffer?.subtotalPrice ?? m.metadata?.subtotalPrice ?? 0);
                      const expiresAtStr = matchingOffer?.expiresAt || (m.metadata?.expiresAt as string) || null;

                      const isExpired =
                        matchingOffer?.status === "EXPIRED" ||
                        Boolean(expiresAtStr && new Date(expiresAtStr) < new Date());
                      const isDeclined = matchingOffer?.status === "DECLINED";
                      const hasBooking = Boolean(
                        selectedConversation.bookingId &&
                        selectedConversation.booking &&
                        selectedConversation.booking.status !== "CANCELLED"
                      );
                      const isAcceptedSystemMsg = messages.some(
                        (msg) => msg.type === "SYSTEM" && msg.metadata?.specialOfferId === offerId
                      );
                      const isAccepted = matchingOffer?.status === "ACCEPTED" || isAcceptedSystemMsg;

                      const checkoutUrl = `/book/${selectedConversation.listing.id}?checkIn=${encodeURIComponent(startDate)}&checkOut=${encodeURIComponent(endDate)}&guests=${guestsCount}&specialOfferId=${encodeURIComponent(offerId)}`;

                      return (
                        <div key={m.id} className="flex justify-center my-3">
                          <div className="max-w-md w-full rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                                  Special Offer from Host
                                </span>
                                {hasBooking ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300">
                                    Booked
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
                                    Accepted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-300">
                                    Available
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-500">{formatMessageTime(m.createdAt)}</span>
                            </div>

                            <p className="text-sm text-zinc-800 font-medium">{m.content}</p>

                            {m.metadata && (
                              <div className="grid grid-cols-2 gap-2 text-xs bg-white/90 p-3 rounded-xl border border-amber-200">
                                <div>
                                  <span className="text-zinc-500 block">Dates:</span>
                                  <span className="font-semibold text-zinc-800">
                                    {startDate && endDate ? formatBookingDateRange(startDate, endDate) : "Dates on request"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block">Special Price:</span>
                                  <span className="font-bold text-amber-900 text-sm">
                                    {currency} {(subtotalPrice / 100).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Actions based on state */}
                            {hasBooking ? (
                              <Link
                                href={`/bookings/${selectedConversation.bookingId}`}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors shadow-xs"
                              >
                                <span>View Confirmed Reservation</span>
                                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                              </Link>
                            ) : isExpired ? (
                              <div className="w-full py-2 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-400 text-xs font-semibold text-center cursor-not-allowed">
                                Offer Expired
                              </div>
                            ) : isDeclined ? (
                              <div className="w-full py-2 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-400 text-xs font-semibold text-center cursor-not-allowed">
                                Offer Declined
                              </div>
                            ) : isAccepted ? (
                              <div className="space-y-1.5">
                                <button
                                  type="button"
                                  disabled={acceptingOffer}
                                  onClick={() => handleAcceptSpecialOffer(offerId, checkoutUrl)}
                                  className="w-full py-2.5 rounded-full bg-[#1F1F1F] text-white text-xs font-semibold hover:bg-black transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                                >
                                  <span>{acceptingOffer ? "Opening Checkout..." : "Proceed to Checkout & Pay"}</span>
                                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                </button>
                                <p className="text-[11px] text-center text-zinc-500 font-normal">
                                  Offer accepted • Click above to resume or complete your booking
                                </p>
                              </div>
                            ) : offerId ? (
                              <button
                                type="button"
                                disabled={acceptingOffer}
                                onClick={() => handleAcceptSpecialOffer(offerId, checkoutUrl)}
                                className="w-full py-2.5 rounded-full bg-[#1F1F1F] text-white text-xs font-semibold hover:bg-black transition-colors disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
                              >
                                <span>{acceptingOffer ? "Processing..." : "Accept & Proceed to Checkout"}</span>
                                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    // Pre-approval Notice
                    if (m.type === "PRE_APPROVAL") {
                      return (
                        <div key={m.id} className="flex justify-center my-3">
                          <div className="max-w-md w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-2xs space-y-2 text-center">
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                              You&apos;re Pre-Approved!
                            </span>
                            <p className="text-xs sm:text-sm text-emerald-950">{m.content}</p>
                            <Link
                              href={`/book/${selectedConversation.listing.id}`}
                              className="inline-block px-5 py-2 rounded-full bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
                            >
                              Book Now
                            </Link>
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
                        className={`flex flex-col ${isGuest ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs space-y-2 ${
                            isGuest
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
                                    isGuest
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
                                      <p className={`text-[10px] ${isGuest ? "text-zinc-300" : "text-zinc-500"}`}>{formatFileSize(att.fileSize)} • PDF Document</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <a
                                      href={att.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                                        isGuest
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
                                        isGuest
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
                          {isGuest && (
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
                      placeholder="Type a message to the host... (Press Enter to send)"
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
              <h2 className="text-base font-bold text-zinc-700">Select a conversation</h2>
              <p className="text-xs text-zinc-500 max-w-xs">
                Select a message on the left to review your chat with the host, accept special offers, or send an inquiry.
              </p>
            </div>
          )}
        </div>
      </div>

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
