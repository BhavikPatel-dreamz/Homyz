"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React from "react";

interface EditorModalsProps {
  isAddCoHostModalOpen: boolean;
  setIsAddCoHostModalOpen: (open: boolean) => void;
  coHostCountryCode: string;
  setCoHostCountryCode: (code: string) => void;
  coHostPhone: string;
  setCoHostPhone: (phone: string) => void;
  coHostEmail: string;
  setCoHostEmail: (email: string) => void;
  coHostsList: any[];
  setCoHostsList: (list: any[]) => void;

  isTurnOffInstantBookModalOpen: boolean;
  setIsTurnOffInstantBookModalOpen: (open: boolean) => void;
  setBookingMethod: (method: "instant" | "approve") => void;

  isCustomMessageModalOpen: boolean;
  setIsCustomMessageModalOpen: (open: boolean) => void;
  customBookingMessage: string;
  setCustomBookingMessage: (msg: string) => void;

  isEditingAdditionalRulesModalOpen: boolean;
  setIsEditingAdditionalRulesModalOpen: (open: boolean) => void;
  additionalHouseRules: string;
  setAdditionalHouseRules: (rules: string) => void;
}

export function EditorModals({
  isAddCoHostModalOpen,
  setIsAddCoHostModalOpen,
  coHostCountryCode,
  setCoHostCountryCode,
  coHostPhone,
  setCoHostPhone,
  coHostEmail,
  setCoHostEmail,
  coHostsList,
  setCoHostsList,
  isTurnOffInstantBookModalOpen,
  setIsTurnOffInstantBookModalOpen,
  setBookingMethod,
  isCustomMessageModalOpen,
  setIsCustomMessageModalOpen,
  customBookingMessage,
  setCustomBookingMessage,
  isEditingAdditionalRulesModalOpen,
  setIsEditingAdditionalRulesModalOpen,
  additionalHouseRules,
  setAdditionalHouseRules,
}: EditorModalsProps) {
  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: ADD YOUR CO-HOST'S INFO */}
      {/* --------------------------------------------------------- */}
      {isAddCoHostModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsAddCoHostModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Add your co-host's info</h3>
              <p className="text-xs text-zinc-500 font-normal">
                We will text or email them the invite
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">
                    Country code *
                  </label>
                  <div className="relative">
                    <select
                      value={coHostCountryCode}
                      onChange={(e) => setCoHostCountryCode(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-zinc-300/90 bg-white px-3.5 py-3 text-xs text-zinc-600 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      <option value="Italy (+39)">Italy (+39)</option>
                      <option value="Saudi Arabia (+966)">Saudi Arabia (+966)</option>
                      <option value="United States (+1)">United States (+1)</option>
                      <option value="United Kingdom (+44)">United Kingdom (+44)</option>
                      <option value="UAE (+971)">UAE (+971)</option>
                      <option value="Germany (+49)">Germany (+49)</option>
                      <option value="France (+33)">France (+33)</option>
                    </select>
                    <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">
                    Phone number *
                  </label>
                  <input
                    type="text"
                    value={coHostPhone}
                    onChange={(e) => setCoHostPhone(e.target.value)}
                    placeholder="xxxx-xxx-xx-xxx"
                    className="w-full rounded-2xl border border-zinc-300/90 bg-white px-4 py-3 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
                  />
                </div>
              </div>

              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-zinc-200" />
                <span className="bg-white px-4 text-xs font-medium text-zinc-400 absolute">
                  or
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-800">
                  Email
                </label>
                <input
                  type="email"
                  value={coHostEmail}
                  onChange={(e) => setCoHostEmail(e.target.value)}
                  placeholder="xxxx-xxx-xx-xxx"
                  className="w-full rounded-2xl border border-zinc-300/90 bg-white px-4 py-3 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsAddCoHostModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const finalPhone = coHostPhone.trim() || "+39 340 123 4567";
                  const finalEmail = coHostEmail.trim() || "cohost@example.com";
                  setCoHostsList([
                    ...coHostsList,
                    {
                      id: Date.now().toString(),
                      phone: finalPhone,
                      email: finalEmail,
                      countryCode: coHostCountryCode,
                      status: "Invite Sent",
                      dateAdded: "Just now",
                    },
                  ]);
                  setCoHostEmail("");
                  setCoHostPhone("");
                  setIsAddCoHostModalOpen(false);
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: TURN OFF INSTANT BOOK */}
      {/* --------------------------------------------------------- */}
      {isTurnOffInstantBookModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-6 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsTurnOffInstantBookModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">
                Are you sure you want to turn off Instant book ?
              </h3>
              <p className="text-xs text-zinc-500 font-normal">
                If so, you'll need to keep these things in mind.
              </p>
            </div>

            <div className="border-t border-zinc-200" />

            <div className="space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">You may get fewer bookings</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Lorem ipsum varius cursus a est ut consequat id elit.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">You'll need to review every booking request</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Lorem ipsum varius cursus a est ut consequat id elit.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs mt-0.5">
                  <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">You'll need to respond to each request in 24 hours</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                    Lorem ipsum varius cursus a est ut consequat id elit.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200" />

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsTurnOffInstantBookModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookingMethod("approve");
                  setIsTurnOffInstantBookModalOpen(false);
                }}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Turn Instant Book off
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: ADD A CUSTOM MESSAGE */}
      {/* --------------------------------------------------------- */}
      {isCustomMessageModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsCustomMessageModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Add a custom message</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Send a welcoming message automatically when guests instant book your space.
              </p>
            </div>

            <textarea
              rows={4}
              value={customBookingMessage}
              onChange={(e) => setCustomBookingMessage(e.target.value)}
              placeholder="Write a custom message for your guests..."
              className="w-full rounded-2xl border border-zinc-300 bg-white p-4 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCustomMessageModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsCustomMessageModalOpen(false)}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save Message
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* --------------------------------------------------------- */}
      {/* GLOBAL MODAL: EDIT ADDITIONAL HOUSE RULES */}
      {/* --------------------------------------------------------- */}
      {isEditingAdditionalRulesModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 relative border border-zinc-150">
            <button
              type="button"
              onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-zinc-950 font-semibold text-sm cursor-pointer p-1"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-semibold text-xl tracking-tight text-[#1F1F1F]">Additional house rules</h3>
              <p className="text-xs text-zinc-500 font-normal">
                Share any specific requirements or guidelines guests must follow.
              </p>
            </div>

            <textarea
              rows={5}
              value={additionalHouseRules}
              onChange={(e) => setAdditionalHouseRules(e.target.value)}
              placeholder="e.g. Please remove shoes inside, no loud music after 10 PM..."
              className="w-full rounded-2xl border border-zinc-300 bg-white p-4 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors shadow-2xs placeholder:text-zinc-300"
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsEditingAdditionalRulesModalOpen(false)}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
              >
                Save Rules
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
