"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useScrollbarDrag } from "@/components/ui/use-scrollbar-drag";
import { BackButton } from "@/components/ui/back-button";
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

const inboxViewIcons = {
  all: "/images/icons/message-filter-all.svg",
  hosting: "/images/icons/message-filter-hosting.svg",
  traveling: "/images/icons/message-filter-traveling.svg",
  support: "/images/icons/streamline-freehand/help-question-circle--Streamline-Freehand.svg",
} as const;

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
  const [inboxView, setInboxView] = useState<"all" | "hosting" | "traveling" | "support">("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const [messagingSettingsOpen, setMessagingSettingsOpen] = useState(false);
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
  const [offerListingId, setOfferListingId] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [preApproveNote, setPreApproveNote] = useState("");
  const [declineReason, setDeclineReason] = useState("Dates not available");
  const [declineNote, setDeclineNote] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevMessagesCountRef = useRef(0);
  const lastScrolledConvIdRef = useRef<string | null>(null);
  const rightPanelScrollRef = useRef<HTMLElement>(null);
  const rightPanelScrollTrackRef = useRef<HTMLDivElement>(null);
  const rightPanelScrollFrameRef = useRef<number | null>(null);
  const [rightPanelScrollThumb, setRightPanelScrollThumb] = useState({ height: 0, top: 0, visible: false });
  const { isDragging: isRightPanelScrollbarDragging, onThumbPointerDown: onRightPanelThumbPointerDown, scrollByPage: scrollRightPanelByPage } = useScrollbarDrag(rightPanelScrollRef, rightPanelScrollTrackRef, rightPanelScrollThumb.height);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;
  const visibleConversations = inboxView === "all" || inboxView === "hosting" ? conversations : [];
  const specialOfferListings = Array.from(new Map(conversations.map((conversation) => [conversation.listing.id, conversation.listing])).values());

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
        setOfferStartDate(conv.booking.startDate.split("T")[0]);
        setOfferEndDate(conv.booking.endDate.split("T")[0]);
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

  const openSpecialOfferModal = () => {
    setOfferListingId(selectedConversation?.listing.id || "");
    setSpecialOfferModalOpen(true);
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
          listingId: offerListingId || selectedConversation?.listing.id,
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

  const updateRightPanelScrollThumb = useCallback(() => {
    if (rightPanelScrollFrameRef.current !== null) cancelAnimationFrame(rightPanelScrollFrameRef.current);
    rightPanelScrollFrameRef.current = requestAnimationFrame(() => {
      const element = rightPanelScrollRef.current;
      if (!element) return;
      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const trackHeight = rightPanelScrollTrackRef.current?.clientHeight || element.clientHeight;
      const arrowSpace = 28;
      const usableTrackHeight = Math.max(0, trackHeight - arrowSpace * 2);
      const height = hasOverflow ? Math.min(60, usableTrackHeight) : 0;
      const maxTop = Math.max(0, usableTrackHeight - height);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? arrowSpace + Math.round((element.scrollTop / scrollRange) * maxTop) : 0;
      setRightPanelScrollThumb((current) => current.height === height && current.top === top && current.visible === hasOverflow ? current : { height, top, visible: hasOverflow });
      rightPanelScrollFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    const element = rightPanelScrollRef.current;
    if (!element) return;
    updateRightPanelScrollThumb();
    const resizeObserver = new ResizeObserver(updateRightPanelScrollThumb);
    const mutationObserver = new MutationObserver(updateRightPanelScrollThumb);
    resizeObserver.observe(element);
    if (rightPanelScrollTrackRef.current) resizeObserver.observe(rightPanelScrollTrackRef.current);
    mutationObserver.observe(element, { childList: true, subtree: true });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (rightPanelScrollFrameRef.current !== null) cancelAnimationFrame(rightPanelScrollFrameRef.current);
    };
  }, [rightPanelScrollThumb.visible, updateRightPanelScrollThumb]);

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
    <div className="messages-workspace flex-1 w-full max-w-[1520px] mx-auto px-0 sm:px-6">
      <div className="grid grid-cols-1 overflow-hidden bg-white lg:grid-cols-[300px_minmax(0,1fr)_362px] xl:grid-cols-[320px_minmax(0,1fr)_362px] lg:h-[calc(100svh-132px)] lg:min-h-[680px] lg:border lg:border-zinc-300">
        {/* ========================================================================= */}
        {/* COLUMN 1: CONVERSATIONS LIST                                              */}
        {/* ========================================================================= */}
        <div className={`flex-col bg-white overflow-hidden lg:border-r lg:border-zinc-300 ${mobileView === "thread" ? "hidden lg:flex" : "flex"}`}>
          {/* Header & Tabs */}
          <div className="border-b border-zinc-200 px-4 pb-8 lg:pt-12 pt-5 space-y-3">
            <div className="flex h-6 items-center justify-between">
              <h1 className="text-lg font-medium text-[#1F1F1F]">Messages</h1>
            </div>

            {/* Filter Pills / Search */}
            <div className="messages-filters flex min-h-10 items-center">
              {searchOpen ? (
                <div className="flex w-full items-center gap-3">
                  <div className={searchClosing
                    ? "relative min-w-0 flex-1 origin-right overflow-hidden motion-safe:animate-[messages-search-collapse_220ms_cubic-bezier(0.4,0,1,1)_forwards]"
                    : "relative min-w-0 flex-1 origin-right overflow-hidden motion-safe:animate-[messages-search-expand_240ms_cubic-bezier(0.2,0,0,1)]"
                  }>
                    <Image
                      src="/images/icons/search-icon.svg"
                      alt=""
                      width={18}
                      height={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2"
                    />
                    <input
                      autoFocus
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search all messages"
                      className="h-10 w-full rounded-full border border-[#717171] bg-white pl-10 pr-3 text-sm text-[#1F1F1F] placeholder:text-[#717171] transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-[#222]/15"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (searchClosing) return;
                      setSearchClosing(true);
                      window.setTimeout(() => {
                        setSearchOpen(false);
                        setSearchClosing(false);
                        setSearch("");
                      }, 220);
                    }}
                    className={searchClosing
                      ? "shrink-0 text-sm font-medium text-[#222] motion-safe:animate-[messages-search-cancel-out_130ms_ease-in_forwards]"
                      : "shrink-0 text-sm font-medium text-[#222] transition-opacity duration-150 hover:opacity-65 motion-safe:animate-[messages-search-cancel-in_160ms_ease-out_100ms_both]"
                    }
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button type="button" onClick={() => setFilterMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={filterMenuOpen} className="inline-flex h-8 min-w-[55px] items-center justify-center gap-1 rounded-full border border-zinc-400 bg-[#FCDF9C] px-3 text-sm font-medium text-[#1F1F1F] transition-colors">
                        {inboxView[0].toUpperCase() + inboxView.slice(1)}
                        <svg className={`size-3.5 transition-transform ${filterMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      {filterMenuOpen && (
                        <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[180px] origin-top-left overflow-hidden rounded-xl border border-[#D7D7D7] bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)] motion-safe:animate-[messages-filter-menu-in_160ms_ease-out]">
                          {(["all", "hosting", "traveling", "support"] as const).map((view) => (
                            <button
                              key={view}
                              type="button"
                              role="menuitem"
                              onClick={() => { setInboxView(view); setFilter("all"); setFilterMenuOpen(false); }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#1F1F1F] transition-colors hover:bg-[#F7F7F7] ${inboxView === view ? "bg-[#F7F7F7] font-medium" : ""}`}
                            >
                              <Image src={inboxViewIcons[view]} alt="" width={16} height={16} className="size-4 object-contain" />
                              {view[0].toUpperCase() + view.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => { setFilter("unread"); setFilterMenuOpen(false); }} className="inline-flex h-8 min-w-[67px] items-center justify-center rounded-full border border-zinc-400 bg-white px-3 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50"><span>Unread</span></button>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => { setFilterMenuOpen(false); setSearchClosing(false); setSearchOpen(true); }} aria-label="Search messages" className="flex size-8 items-center justify-center rounded-full border border-[#727272] text-[#1F1F1F] transition-transform duration-150 hover:scale-105 hover:bg-zinc-50 active:scale-95">
                      <Image src="/images/icons/search-icon.svg" alt="" width={16} height={16} className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilterMenuOpen(false); setMessagingSettingsOpen(true); }}
                      aria-label="Open messaging settings"
                      className="flex size-8 items-center justify-center rounded-full border border-[#727272] bg-transparent p-0"
                    >
                      <Image src="/images/icons/setting-icon.svg" alt="" width={16} height={16} className="size-4" />
                    </button>

                  </div>
                </>
              )}
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
            ) : visibleConversations.length === 0 ? (
              <div className="p-8 text-center text-[#727272] space-y-2">
                <svg
                  className="mx-auto size-10 text-zinc-400"
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
                <p className="text-sm font-medium text-[#1f1f1f]">No messages found</p>
                <p className="text-sm">Guest inquiries and booking messages will appear here.</p>
              </div>
            ) : (
              visibleConversations.map((conv) => {
                const isSelected = conv.id === selectedId;
                const hasUnread = conv.unreadCount > 0;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left p-3.5 sm:p-4 flex gap-3 transition-colors duration-300 ${isSelected
                      ? "bg-[#F3F4F5]"
                      : "hover:bg-[#F3F4F5]"
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
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-[#1F1F1F]" : "font-normal text-[#242424]"}`}>
                          {conv.guest.name || "Guest"}
                        </span>
                        <span className="text-xs text-[#616161] shrink-0">
                          {formatListDate(conv.lastMessageAt)}
                        </span>
                      </div>

                      <p className="hidden">
                        {conv.listing.title}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-xs text-[#616161]`}>
                          {getMessagePreview(conv.lastMessage)}
                        </p>
                        {/* <span className="shrink-0">{getStatusBadge(conv.status, conv.activeSpecialOffer)}</span> */}
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
        <div className={`flex h-[calc(100dvh-76px)] flex-col overflow-hidden bg-white min-w-0 lg:h-auto lg:border-r lg:border-zinc-200 ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
          {selectedConversation ? (
            <>
              {/* Thread Top Bar */}
              <div className="border-b border-zinc-100 p-4 lg:hidden">
                <div className="flex min-w-0 items-center gap-3 lg:flex-col lg:gap-0 lg:text-center">
                  <BackButton onClick={() => setMobileView("list")} className="-ml-1 lg:hidden" aria-label="Back to messages" />
                  <div className="lg:hidden">
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
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-[#1F1F1F] truncate">
                      {selectedConversation.guest.name || "Guest"}
                    </h3>
                    <p className="text-xs text-zinc-500 truncate">
                      {selectedConversation.listing.title}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons (Pre-approve, Special offer, Decline) */}
                <div className="mt-3 flex items-center gap-2 lg:hidden overflow-x-auto">
                  {selectedConversation.status !== "CONFIRMED" && selectedConversation.status !== "DECLINED" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreApproveModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                      >
                        Pre-approve
                      </button>
                      <button
                        type="button"
                        onClick={openSpecialOfferModal}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#FCDF9C] text-[#1F1F1F] hover:bg-[#F7D37D] transition-colors whitespace-nowrap"
                      >
                        Special offer
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclineModalOpen(true)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-zinc-600 hover:bg-zinc-100 border border-zinc-200 transition-colors whitespace-nowrap"
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
                  className="flex-1 overflow-y-auto space-y-4 bg-white px-5 py-8 sm:px-12 sm:py-12"
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
                    <>
                      <div className="pb-12 text-center">
                        <p className="text-sm font-semibold text-zinc-900">Today</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">Inquiry sent · Date · Time</p>
                      </div>
                      {messages.map((m) => {
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
                                <div className="flex items-center justify-between flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                                      Special Offer Sent
                                    </span>
                                    {hasBooking ? (
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                        Booked & Confirmed
                                      </span>
                                    ) : isExpired ? (
                                        <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 border border-zinc-300 whitespace-nowrap">
                                        Expired
                                      </span>
                                    ) : isDeclined ? (
                                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200 whitespace-nowrap">
                                        Declined
                                      </span>
                                    ) : isAccepted ? (
                                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                        Accepted by Guest
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-medium text-amber-900 border border-amber-300 whitespace-nowrap">
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
                                      <span className="text-[#1f1f1f] block">Dates:</span>
                                      <span className="font-medium text-[#1f1f1f]">
                                        {String(m.metadata.startDate || "")} - {String(m.metadata.endDate || "")}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[#1f1f1f] block">Total Offer:</span>
                                      <span className="font-medium text-amber-900 text-sm">
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
                            className={`relative flex flex-col ${isHost ? "items-end" : "items-start pl-10"}`}
                          >
                            {!isHost && (
                              <div className="absolute left-0 top-4 flex size-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                                {(selectedConversation.guest.name || "G")[0].toUpperCase()}
                                <span className="absolute -right-0.5 bottom-0 size-2.5 rounded-full border-2 border-white bg-green-500" />
                              </div>
                            )}
                            <div className="order-1 mb-1 flex items-center gap-2 px-1 text-[10px] text-zinc-400">
                              <span>{isHost ? "You" : selectedConversation.guest.name || "Guest"}</span>
                              <span>{formatMessageTime(m.createdAt)}</span>
                            </div>
                            <div
                              className={`order-2 max-w-[85%] sm:max-w-[72%] rounded-lg px-3 py-2 text-xs sm:text-sm leading-relaxed shadow-none space-y-2 ${isHost
                                ? "bg-[#E9EBFF] text-zinc-800 rounded-br-sm"
                                : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                                }`}
                            >
                              {m.type === "BOOKING_REQUEST" && (
                                <div className="border-b border-zinc-200 pb-1.5 text-[11px] font-semibold text-zinc-500">
                                  {isHost ? "You" : selectedConversation.guest.name || "Guest"}
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
                                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${isHost
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
                                          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${isHost
                                            ? "bg-white/20 hover:bg-white/30 text-white"
                                            : "bg-zinc-200 hover:bg-zinc-300 text-zinc-800"
                                            }`}
                                        >
                                          Open
                                        </a>
                                        <a
                                          href={`${att.fileUrl}?download=true`}
                                          download={att.fileName}
                                          className={`p-1.5 rounded-lg transition-colors ${isHost
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
                          </div>
                        );
                      })}
                    </>
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
              <div className="sticky bottom-0 z-20 shrink-0 border-t border-zinc-300 bg-white px-4 py-4 sm:px-6 sm:py-5 space-y-2 lg:static">
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

                <form onSubmit={handleSendMessage} className="relative mx-auto flex w-full max-w-none flex-nowrap items-stretch gap-3 rounded-none border-0 bg-transparent p-0 lg:flex-wrap lg:items-end lg:gap-0 lg:rounded-md lg:border lg:border-[#727272] lg:bg-white lg:p-4">

                  {/* Textarea */}
                  <div className="order-2 mb-0 min-w-0 flex-1 lg:order-none lg:mb-3 lg:w-full lg:flex-none">
                    <textarea
                      rows={1}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type a message"
                      className="h-[88px] w-full resize-none rounded-[8px] border border-[#727272] bg-white px-4 pb-4 pt-4 pr-12 sm:text-base text-sm text-[#1f1f1f] placeholder:text-[#727272] focus:outline-none lg:h-full lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
                    />
                  </div>

                  {/* Attachment button */}
                  <div className="order-1 flex w-8 shrink-0 flex-col items-center justify-center gap-y-3 lg:order-none lg:w-auto lg:flex-row lg:gap-x-3 lg:content-between">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex size-8 items-center justify-center rounded-full border border-[#1f1f1f] transition-opacity hover:opacity-70 lg:size-6"
                      title="Attach a photo or document"
                      aria-label="Attach a photo or document"
                    >
                      <Image src="/images/icons/homyz/stroke/Plus.svg" alt="" width={15} height={15} className="size-4 lg:size-3.75" />
                    </button>
                    <span className="flex size-8 items-center justify-center lg:size-6" aria-hidden="true">
                      <Image src="/images/icons/messages.svg" alt="" width={24} height={24} className="size-8 lg:size-6" />
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="submit"
                    disabled={
                      (!inputText.trim() && !stagedAttachments.some((a) => a.status === "UPLOADED")) ||
                      sending ||
                      stagedAttachments.some((a) => a.status === "UPLOADING")
                    }
                    className={`absolute bottom-4 right-2 z-10 flex size-9 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1f1f1f] shadow-sm transition-colors duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 group lg:static lg:ml-auto lg:size-7 lg:shadow-none ${inputText.trim() || stagedAttachments.length > 0 ? "" : "hidden"}`}
                    aria-label={sending ? "Sending message" : "Send message"}
                    title={sending ? "Sending..." : "Send message"}
                  >
                    {sending ? (
                      <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M12 3a9 9 0 0 0 0 18v-4a5 5 0 0 1 0-10V3Z" />
                      </svg>
                    ) : (
                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h13m-5-5 5 5-5 5" />
                      </svg>
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
              <h3 className="text-xl font-medium text-[#1f1f1f]">Select a conversation</h3>
              <p className="text-sm text-[#727272] max-w-xs">
                Choose a guest from the left panel to review inquiries, send special offers, or respond to booking messages.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: CONTEXT & RESERVATION PANEL                                     */}
        {/* ========================================================================= */}
        <div className="relative hidden min-h-0 lg:flex">
          <aside ref={rightPanelScrollRef} onScroll={updateRightPanelScrollThumb} className="custom-scrollbar flex h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain bg-white pl-5.25 pr-[38px] py-12">
          {selectedConversation ? (
            <>
              <section className="border-b border-[#D7D7D7] pb-4">
                <p className="text-xs text-zinc-500">Inquiry</p>
                <h2 className="guest-name mt-1 text-xl font-medium text-[#727272]"><span className="text-[#1f1f1f]">{selectedConversation.guest.name || "Guest"}</span> asked about your trip</h2>
                <p className="property-location mt-3 text-sm text-[#1f1f1f] font-normal">{selectedConversation.listing.title}</p>
                <p className="countryname text-sm text-[#727272]">{[selectedConversation.listing.city, selectedConversation.listing.country].filter(Boolean).join(", ")}</p>
                {selectedConversation.status !== "CONFIRMED" && selectedConversation.status !== "DECLINED" && (
                  <div className="mt-6 space-y-3">
                    <button type="button" onClick={() => setPreApproveModalOpen(true)} className="flex h-9 w-full items-center justify-center rounded-lg border border-[#727272] px-3 text-base font-normal text-[#1F1F1F] transition-colors hover:bg-zinc-50">Pre-approve</button>
                    <button type="button" onClick={openSpecialOfferModal} className="flex h-9 w-full items-center justify-center rounded-lg border border-[#727272] px-3 text-base font-normal text-[#1F1F1F] transition-colors hover:bg-zinc-50">Special offer</button>
                    <button type="button" onClick={() => setDeclineModalOpen(true)} className="flex h-9 w-full items-center justify-center rounded-lg border border-[#727272] px-3 text-base font-normal text-[#1F1F1F] transition-colors hover:bg-zinc-50">Decline</button>
                  </div>
                )}
              </section>

              {/* Listing Card */}
              <div className="rounded-[10px] border border-[#E5E5E5] bg-white p-3.5 shadow-[0_2px_5px_rgba(0,0,0,0.12)] space-y-2.5">
                <h4 className="text-base font-medium text-[#1F1F1F]">Listing</h4>
                <div className="flex gap-3 items-center">
                  {selectedConversation.listing.photos[0] ? (
                    <Image
                      src={selectedConversation.listing.photos[0]}
                      alt={selectedConversation.listing.title}
                      width={64}
                      height={64}
                      className="size-14 rounded-[10px] object-cover shrink-0 border border-zinc-200"
                    />
                  ) : (
                    <div className="size-14 rounded-[10px] bg-zinc-100 shrink-0 border border-zinc-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1F1F1F] truncate">
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
                  className="block text-center w-full py-2 rounded-[8px] border border-[#727272] text-sm font-medium text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                >
                  View Listing
                </Link>
              </div>

              {/* Guest Profile Card */}
              <div className="rounded-[10px] border border-[#E5E5E5] bg-white p-3.5 shadow-[0_2px_5px_rgba(0,0,0,0.12)] space-y-2.5">
                <h4 className="text-base font-medium text-[#1F1F1F]">About the Guest</h4>
                <div className="flex items-center gap-3">
                  {selectedConversation.guest.image ? (
                    <Image
                      src={selectedConversation.guest.image}
                      alt={selectedConversation.guest.name || "Guest"}
                      width={48}
                      height={48}
                      className="size-10 rounded-full object-cover border border-zinc-200"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-sm">
                      {(selectedConversation.guest.name || "G")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F1F1F] truncate">
                      {selectedConversation.guest.name || "Guest"}
                    </p>
                    <p className="text-sm text-[#727272]">
                      Member since {new Date(selectedConversation.guest.createdAt).getFullYear()}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#E5E5E5] text-sm text-[#727272] space-y-1.5">
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

              {/* Booking details */}
              <section className="border-t border-[#E5E5E5] pt-5 space-y-3">
                <div className="flex items-center justify-between sm:flex-row flex-col">
                  <h4 className="text-xl font-medium text-[#1F1F1F]">Booking details</h4>
                  {getStatusBadge(selectedConversation.status, selectedConversation.activeSpecialOffer)}
                </div>

                {selectedConversation.booking ? (
                  (() => {
                    const b = selectedConversation.booking;
                    const fmt = (d: string | Date) =>
                      new Date(d).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                    const cardClass =
                      "rounded-[10px] bg-white px-4 py-3 shadow-[0_2px_5px_rgba(0,0,0,0.12)]";

                    return (
                      <div className="space-y-3">
                        <div className={cardClass}>
                          <p className="text-base font-medium text-[#1F1F1F]">Guests</p>
                          <p className="text-base text-zinc-500">
                            {b.guests} {b.guests === 1 ? "Guest" : "Guests"}
                          </p>
                        </div>

                        <div className={cardClass}>
                          <p className="text-base font-medium text-[#1F1F1F]">Check-in</p>
                          <p className="text-base text-zinc-500">{fmt(b.startDate)}</p>
                        </div>

                        <div className={cardClass}>
                          <p className="text-base font-medium text-[#1F1F1F]">Check-out</p>
                          <p className="text-base text-zinc-500">{fmt(b.endDate)}</p>
                        </div>

                        <div className={cardClass}>
                          <p className="text-base font-medium text-[#1F1F1F]">Total price</p>
                          <p className="text-base text-zinc-500">
                            {b.currency} {((b.totalPrice || 0) / 100).toFixed(2)}
                          </p>
                        </div>

                        {b.cancellationPolicy && (
                          <div className={cardClass}>
                            <p className="text-base font-medium text-[#1F1F1F]">Cancellation policy</p>
                            <p className="text-base text-zinc-500 capitalize">
                              {b.cancellationPolicy.toLowerCase()}
                            </p>
                          </div>
                        )}

                        <Link
                          href="/calendar"
                          className="inline-block text-base font-medium text-[#1F1F1F] underline underline-offset-2 hover:text-black"
                        >
                          Show calendar
                        </Link>

                        <Link
                          href={`/bookings/${b.id}`}
                          className="block text-center w-full py-3 rounded-lg bg-[#FCDF9C] text-[#1F1F1F] hover:text-white text-base font-medium hover:bg-[#1F1F1F] transition-colors"
                        >
                          View Reservation Details
                        </Link>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-3 text-sm text-zinc-600">
                    <p>This is a pre-booking inquiry. The guest has not yet confirmed a reservation.</p>
                    <button
                      type="button"
                      onClick={() => setPreApproveModalOpen(true)}
                      className="w-full py-2.5 rounded-[10px] border border-zinc-400 text-[#1F1F1F] text-base font-medium hover:bg-zinc-50 transition-colors"
                    >
                      Pre-approve
                    </button>
                    <button
                      type="button"
                      onClick={openSpecialOfferModal}
                      className="w-full py-2.5 rounded-[10px] border border-zinc-400 text-[#1F1F1F] text-base font-medium hover:bg-zinc-50 transition-colors"
                    >
                      Special offer
                    </button>
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-xs text-zinc-400">
              Context and stay details will appear here.
            </div>
          )}
          </aside>
          {rightPanelScrollThumb.visible && (
            <div ref={rightPanelScrollTrackRef} className="absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-white lg:block">
              <button type="button" aria-label="Scroll message details up" onClick={() => scrollRightPanelByPage("up")} className="absolute left-0 top-1 z-10 flex size-[22px] items-center justify-center rounded-full text-[#727272] transition hover:bg-white/70 hover:text-[#1f1f1f]">
                <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" /></svg>
              </button>
              <div onPointerDown={onRightPanelThumbPointerDown} className={`absolute left-0 top-0 w-[22px] touch-none select-none rounded-[30px] border border-white bg-[#DDDDDE] shadow-[0_2px_4px_rgba(0,0,0,0.25)] will-change-transform ${isRightPanelScrollbarDragging ? "cursor-grabbing" : "cursor-grab"}`} style={{ height: `${rightPanelScrollThumb.height}px`, transform: `translate3d(0, ${rightPanelScrollThumb.top}px, 0)` }} />
              <button type="button" aria-label="Scroll message details down" onClick={() => scrollRightPanelByPage("down")} className="absolute bottom-1 left-0 z-10 flex size-[22px] items-center justify-center rounded-full text-[#727272] transition hover:bg-white/70 hover:text-[#1f1f1f]">
                <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: MESSAGING SETTINGS                                                 */}
      {/* ========================================================================= */}
      {messagingSettingsOpen && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="messaging-settings-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMessagingSettingsOpen(false);
          }}
        >
          <section className="messages-settings-sheet max-h-[calc(100svh-24px)] w-full max-w-[720px] overflow-y-auto rounded-t-[32px] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] sm:max-h-[calc(100svh-32px)] sm:rounded-[30px] sm:px-8 sm:py-5" onMouseDown={(event) => event.stopPropagation()}>
            <header className="relative flex min-h-8 items-center justify-center">
              <h2 id="messaging-settings-title" className="text-xl font-medium text-[#1f1f1f]">Messaging settings</h2>
              <button
                type="button"
                onClick={() => setMessagingSettingsOpen(false)}
                aria-label="Close messaging settings"
                className="absolute right-0 flex size-8 items-center justify-center rounded-full text-[#222] transition-colors hover:bg-zinc-100"
              >
                <Image src="/images/icons/homyz/stroke/X.svg" alt="" width={20} height={20} className="size-5" />
              </button>
            </header>

            <div className="mt-3 space-y-0 sm:mt-5 sm:space-y-2">
              {[
                { label: "Manage quick replies", icon: "/images/icons/messages.svg" },
                { label: "Suggested replies", icon: "/images/icons/homyz/stroke/Sparkles.svg" },
                { label: "Archived", icon: "/images/icons/homyz/stroke/Archive.svg" },
                { label: "Give feedback", icon: "/images/icons/homyz/stroke/Paper airplane.svg" },
              ].map((item) => (
                <div key={item.label} className="flex h-14 items-center gap-4 rounded-xl px-0 text-base text-[#222] transition-colors hover:bg-[#F7F7F7] sm:h-[70px] sm:px-6">
                  <Image src={item.icon} alt="" width={24} height={24} className={`size-6 object-contain ${item.label === "Give feedback" ? "rotate-45" : ""}`} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SPECIAL OFFER                                                      */}
      {/* ========================================================================= */}
      {specialOfferModalOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="special-offer-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSpecialOfferModalOpen(false);
          }}
        >
          <section className="w-full max-w-[400px] rounded-[12px] bg-white px-6 py-5 text-[#1F1F1F] shadow-[0_12px_32px_rgba(0,0,0,0.18)] sm:max-w-[475px] sm:rounded-[20px] pt-11 pb-8" onMouseDown={(event) => event.stopPropagation()}>
            <header className="relative pr-8">
              <h3 id="special-offer-title" className="text-xl text-[#727272] font-medium leading-7 tracking-[-0.02em]">
                Send <span className="text-[#1f1f1f]">{selectedConversation?.guest.name || "Guest"}</span> a special offer
              </h3>
              <button
                type="button"
                onClick={() => setSpecialOfferModalOpen(false)}
                aria-label="Close special offer"
                className="absolute right-0 -top-[25px] flex size-7 items-center justify-center rounded-full transition-colors hover:bg-zinc-100"
              >
                <Image src="/images/icons/homyz/stroke/X.svg" alt="" width={20} height={20} className="size-5" />
              </button>
              <p className="mt-1.5 max-w-[360px] text-sm leading-5 text-[#727272]">
                {selectedConversation?.guest.name || "The guest"} will have 24 hours to book. In the meantime, your calendar will remain open.
              </p>
            </header>

            <form onSubmit={handleSendSpecialOffer} className="mt-6 space-y-3">
              <div>
                <label className="mb-1.5 block text-base font-medium">Listing</label>
                <div className="relative">
                  <select
                    value={offerListingId || selectedConversation?.listing.id || ""}
                    onChange={(event) => setOfferListingId(event.target.value)}
                    className="h-12 w-full appearance-none rounded-[10px] border border-[#727272] bg-white px-4 pr-10 text-base outline-none transition-shadow focus:ring-2 focus:ring-[#1F1F1F]/15"
                    aria-label="Listing for this special offer"
                  >
                    {(specialOfferListings.length ? specialOfferListings : selectedConversation ? [selectedConversation.listing] : []).map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {[listing.title, listing.city, listing.country].filter(Boolean).join(", ") || "Property name, City, Country"}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-2 text-xs text-[#727272]">Check-in</span>
                  <input
                    type="date"
                    required
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                    className="h-[76px] w-full rounded-[10px] border border-[#727272] px-4 pt-5 text-base font-medium text-[#1F1F1F] outline-none transition-shadow focus:ring-2 focus:ring-[#1F1F1F]/15 sm:h-[68px]"
                  />
                </label>
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-2 text-xs text-[#727272]">Check-out</span>
                  <input
                    type="date"
                    required
                    value={offerEndDate}
                    onChange={(e) => setOfferEndDate(e.target.value)}
                    className="h-[76px] w-full rounded-[10px] border border-[#727272] px-4 pt-5 text-base font-medium text-[#1F1F1F] outline-none transition-shadow focus:ring-2 focus:ring-[#1F1F1F]/15 sm:h-[68px]"
                  />
                </label>
              </div>

              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-2 text-xs text-[#727272]">Guests</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={offerGuests}
                  onChange={(e) => setOfferGuests(parseInt(e.target.value, 10) || 1)}
                  className="h-[68px] w-full appearance-none rounded-[10px] border border-[#727272] px-4 pt-5 text-base font-medium text-[#1F1F1F] outline-none transition-shadow focus:ring-2 focus:ring-[#1F1F1F]/15"
                />
                <svg className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </label>

              <div>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  placeholder="Subtotal"
                  value={offerSubtotal}
                  onChange={(e) => setOfferSubtotal(e.target.value)}
                  className="h-12 w-full rounded-[10px] border border-[#727272] px-4 text-base font-medium text-[#1F1F1F] placeholder:text-[#1F1F1F] outline-none transition-shadow focus:ring-2 focus:ring-[#1F1F1F]/15"
                  aria-label={`Special subtotal in ${selectedConversation?.booking?.currency || "SAR"}`}
                />
                <p className="mt-3 text-sm leading-5 text-[#727272]">
                  Enter a subtotal that includes any cleaning or extra guest fee. This won&apos;t include service fees or applicable taxes.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setSpecialOfferModalOpen(false)}
                  className="h-12 w-full rounded-full border border-[#1F1F1F] px-6 text-base font-medium transition-colors hover:bg-[#1F1F1F] hover:text-white duration-300 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="h-12 w-full rounded-full bg-[#FCDF9C] px-6 text-base font-medium text-[#1F1F1F] hover:text-white transition-colors hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-50 duration-300 sm:w-auto"
                >
                  {modalSubmitting ? "Sending..." : "Send special offer"}
                </button>
              </div>
            </form>
          </section>
        </ModalOverlay>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRE-APPROVE                                                        */}
      {/* ========================================================================= */}
      {preApproveModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-medium text-[#1F1F1F]">Pre-approve Guest Inquiry</h3>
            <p className="text-sm text-[#727272]">
              Pre-approving lets {selectedConversation?.guest.name || "the guest"} book immediately without needing additional approval. The guest will receive a notification and has 24 hours to complete their reservation.
            </p>
            <div>
              <label className="block text-sm font-medium text-[#1f1f1f] mb-1">
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
                className="px-5 py-2.5 rounded-full text-sm font-medium text-[#1f1f1f] border-[#1f1f1f] border hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSubmitting}
                onClick={handlePreApprove}
                className="px-6 py-2.5 rounded-full bg-emerald-600 border-emerald-600 hover:border-emerald-700 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
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
            <h3 className="text-lg font-semibold text-[#1F1F1F]">Decline Inquiry</h3>
            <div>
              <label className="block text-sm font-medium text-[#1f1f1f] mb-1">Reason</label>
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
              <label className="block text-sm font-medium text-[#1f1f1f] mb-1">
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
            <div className="flex max-[340px]:flex-col justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeclineModalOpen(false)}
                className="px-5 py-2.5 rounded-full border border-[#1f1f1f] text-sm font-medium text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSubmitting}
                onClick={handleDecline}
                className="px-6 py-2.5 rounded-full bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
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

