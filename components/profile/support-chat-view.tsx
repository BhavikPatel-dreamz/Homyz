"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface ChatMessage {
  id: string;
  sender: "agent" | "user";
  text: string;
  time: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "agent",
    text: "Hello! Welcome to Homyz 24/7 Guest Care. How can I assist you with your trips, booking modifications, or account today?",
    time: "Just now",
  },
];

const SUGGESTIONS = [
  "I need to change my check-in time",
  "How do I request a booking cancellation?",
  "Where can I find my payment invoice?",
  "How can I contact my property host?",
];

export function SupportChatView({ user }: { user?: { name?: string | null } }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: trimmed,
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // Automated agent reply simulation
    setTimeout(() => {
      let replyText = "Thank you for reaching out! A member of our concierge team is reviewing your request and will follow up with full details.";
      const lower = trimmed.toLowerCase();
      if (lower.includes("check-in") || lower.includes("time")) {
        replyText = "Early check-in requests are handled directly by your host. You can message them through your Reservation Details card or let us know your desired arrival hour!";
      } else if (lower.includes("cancel") || lower.includes("refund")) {
        replyText = "Free cancellation depends on your booking's policy. If cancelled at least 48 hours prior to check-in, you receive a full refund.";
      } else if (lower.includes("invoice") || lower.includes("payment")) {
        replyText = "Receipts and PDF invoices are available in your Past Bookings tab under each completed stay. We can also email a copy directly!";
      } else if (lower.includes("host") || lower.includes("contact")) {
        replyText = "Your host's direct phone number and message portal are accessible from your Upcoming Trips reservation card.";
      }

      const agentReply: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "agent",
        text: replyText,
        time: "Just now",
      };
      setMessages((prev) => [...prev, agentReply]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-6 lg:mb-8">
        <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
          Support / Chat with Agent
        </h2>
        <p className="mt-1 text-sm leading-5 text-[#727272] sm:text-base sm:leading-6">
          We are available 24/7. Ask questions, report trip issues, or chat live with a Homyz customer experience specialist.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Live Chat Box */}
        <div className="flex flex-col rounded-3xl border border-[#E5E5E5] bg-white shadow-xs overflow-hidden h-[540px]">
          {/* Agent Chat Header */}
          <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-zinc-50/70 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-full border border-zinc-200 bg-white">
                <Image
                  src="/images/header-user-avatar.jpg"
                  alt="Support agent"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1F1F1F]">Sarah • Homyz Care</span>
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  Online • Typically replies instantly
                </span>
              </div>
            </div>
            <span className="text-[11px] text-[#727272]">24/7 Live Concierge</span>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.sender === "user"
                      ? "bg-[#1F1F1F] text-white rounded-br-none"
                      : "bg-[#F3F4F5] text-[#1F1F1F] rounded-bl-none"
                  }`}
                >
                  {m.text}
                </div>
                <span className="mt-1 text-[10px] text-[#727272] px-1">
                  {m.time}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-[#727272] italic px-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce delay-100" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce delay-200" />
                Sarah is typing...
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="border-t border-[#E5E5E5] bg-white px-4 py-2 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 whitespace-nowrap">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-[#D7D7D7] bg-white px-3 py-1 text-[11px] font-medium text-[#1F1F1F] hover:bg-[#FFF8E8] hover:border-[#FCDF9C] transition-colors shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputText);
            }}
            className="flex items-center gap-2 border-t border-[#E5E5E5] bg-white p-3"
          >
            <input
              type="text"
              placeholder="Type your message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 rounded-full border border-[#D7D7D7] px-4 py-2 text-sm text-[#1F1F1F] placeholder:text-[#727272] focus:border-[#1F1F1F] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-10 items-center justify-center rounded-full bg-[#FCDF9C] px-5 text-sm font-semibold text-[#1F1F1F] hover:bg-[#F7D37D] disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </form>
        </div>

        {/* Other Help Channels */}
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
            <h4 className="text-sm font-bold text-[#1F1F1F]">Phone Support</h4>
            <p className="mt-1 text-xs text-[#727272] leading-relaxed">
              For immediate assistance with active reservations:
            </p>
            <a
              href="tel:+18005554669"
              className="mt-3 block text-sm font-bold text-[#1F1F1F] hover:underline"
            >
              +1 (800) 555-HOMYZ
            </a>
            <span className="mt-0.5 text-[10px] text-[#727272]">Toll-free 24/7</span>
          </div>

          <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
            <h4 className="text-sm font-bold text-[#1F1F1F]">Email Support</h4>
            <p className="mt-1 text-xs text-[#727272] leading-relaxed">
              Send documents or detailed billing inquiries:
            </p>
            <a
              href="mailto:support@homyz.app"
              className="mt-3 block text-sm font-bold text-[#1F1F1F] hover:underline"
            >
              support@homyz.app
            </a>
            <span className="mt-0.5 text-[10px] text-[#727272]">Avg response: 1-2 hours</span>
          </div>

          <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
            <h4 className="text-sm font-bold text-[#1F1F1F]">Help Centre</h4>
            <p className="mt-1 text-xs text-[#727272] leading-relaxed">
              Find instant answers to FAQs, cancellation policies, and guest guides.
            </p>
            <a
              href="/help"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1F1F1F] hover:underline"
            >
              <span>Browse Help Articles</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
