"use client";

import React, { useState } from "react";

interface BookingArrivalInfoProps {
  isArrivalInfoReleased: boolean;
  arrivalReleaseDateTime: Date | string;
  checkInMethod: string | null;
  checkInStart: string | null;
  checkInEnd: string | null;
  checkOutTime: string | null;
  address: string | null;
  apartment: string | null;
  city: string | null;
  country: string | null;
  directions: string | null;
  parkingInstructions: string | null;
  checkInInstructions: string | null;
  houseManual: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  doorCode: string | null;
  lockboxCode: string | null;
  isConfirmedOrCurrent: boolean;
}

function formatDate(val: Date | string): string {
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function CopyBadge({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 transition-colors cursor-pointer"
      title={`Copy ${label}`}
    >
      <span>{copied ? "Copied!" : "Copy"}</span>
      <svg className="h-3.5 w-3.5 text-[#727272]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}

export function BookingArrivalInfo({
  isArrivalInfoReleased,
  arrivalReleaseDateTime,
  checkInMethod,
  checkInStart,
  checkInEnd,
  checkOutTime,
  address,
  apartment,
  city,
  country,
  directions,
  parkingInstructions,
  checkInInstructions,
  houseManual,
  wifiNetwork,
  wifiPassword,
  doorCode,
  lockboxCode,
  isConfirmedOrCurrent,
}: BookingArrivalInfoProps) {
  const fullAddress = [address, apartment, city, country]
    .filter((v): v is string => Boolean(v?.trim()))
    .join(", ");

  const directionsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null;

  const methodLabel =
    checkInMethod === "SMART_LOCK"
      ? "Smart lock self check-in"
      : checkInMethod === "KEYPAD"
        ? "Keypad digital lock"
        : checkInMethod === "LOCKBOX"
          ? "Lockbox key collection"
          : checkInMethod === "HOST_MEET"
            ? "Host greeting in person"
            : checkInMethod || "Self check-in";

  return (
    <section className="border-b border-zinc-200 py-7" aria-labelledby="arrival-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="arrival-heading" className="text-xl font-semibold text-[#1F1F1F]">
          Arrival & check-in
        </h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
          {methodLabel}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {/* Address & Navigation */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#727272] uppercase tracking-wider">Address</p>
              <p className="mt-1 text-base font-semibold text-[#1F1F1F]">
                {fullAddress || "Full address will be available after confirmation."}
              </p>
              {apartment && (
                <p className="text-xs text-zinc-600 mt-0.5 font-medium">
                  Building / Unit: {apartment}
                </p>
              )}
            </div>
            {directionsUrl && (
              <div className="flex items-center gap-2 shrink-0">
                <CopyBadge text={fullAddress} label="address" />
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F1F1F] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  <span>Google Maps</span>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Check-in Times */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold text-[#727272] uppercase tracking-wider">Check-in Window</p>
            <p className="mt-1 text-sm font-semibold text-[#1F1F1F]">
              {checkInStart ? `${checkInStart}` : "3:00 PM"}
              {checkInEnd ? ` – ${checkInEnd}` : " onwards"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold text-[#727272] uppercase tracking-wider">Check-out Time</p>
            <p className="mt-1 text-sm font-semibold text-[#1F1F1F]">
              {checkOutTime || "11:00 AM"}
            </p>
          </div>
        </div>

        {/* Time-Gated Access Codes & Instructions */}
        {!isArrivalInfoReleased ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-950">
                  Access codes & check-in instructions protected
                </h3>
                <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                  {isConfirmedOrCurrent
                    ? `To ensure host security, access door codes, lockbox combinations, and Wi-Fi credentials will unlock automatically 48 hours before check-in (${formatDate(arrivalReleaseDateTime)}).`
                    : "Check-in instructions and access codes will be provided once your booking is confirmed."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Door / Lockbox Access Credentials */}
            {(doorCode || lockboxCode) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-emerald-950">
                      Key & Access Codes
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-4">
                      {doorCode && (
                        <div className="flex items-center gap-2 rounded-xl bg-white border border-emerald-200 px-3.5 py-2">
                          <span className="text-xs text-[#727272] font-medium">Door code:</span>
                          <span className="font-mono text-sm font-bold text-[#1F1F1F]">{doorCode}</span>
                          <CopyBadge text={doorCode} label="door code" />
                        </div>
                      )}
                      {lockboxCode && (
                        <div className="flex items-center gap-2 rounded-xl bg-white border border-emerald-200 px-3.5 py-2">
                          <span className="text-xs text-[#727272] font-medium">Lockbox code:</span>
                          <span className="font-mono text-sm font-bold text-[#1F1F1F]">{lockboxCode}</span>
                          <CopyBadge text={lockboxCode} label="lockbox code" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Wi-Fi Details */}
            {(wifiNetwork || wifiPassword) && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[#1F1F1F]">Wi-Fi Connection</h3>
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {wifiNetwork && (
                        <div className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2">
                          <div>
                            <span className="block text-[11px] text-[#727272] uppercase tracking-wider font-semibold">Network</span>
                            <span className="font-medium text-sm text-[#1F1F1F]">{wifiNetwork}</span>
                          </div>
                          <CopyBadge text={wifiNetwork} label="network" />
                        </div>
                      )}
                      {wifiPassword && (
                        <div className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2">
                          <div>
                            <span className="block text-[11px] text-[#727272] uppercase tracking-wider font-semibold">Password</span>
                            <span className="font-mono font-medium text-sm text-[#1F1F1F]">{wifiPassword}</span>
                          </div>
                          <CopyBadge text={wifiPassword} label="password" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Check-in Instructions */}
            {checkInInstructions && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
                <h3 className="text-sm font-semibold text-[#1F1F1F]">Check-in Instructions</h3>
                <p className="mt-2 whitespace-pre-line text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  {checkInInstructions}
                </p>
              </div>
            )}

            {/* Directions & Parking */}
            {(directions || parkingInstructions) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {directions && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Directions</h4>
                    <p className="mt-1.5 whitespace-pre-line text-xs text-zinc-600 leading-relaxed">
                      {directions}
                    </p>
                  </div>
                )}
                {parkingInstructions && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Parking</h4>
                    <p className="mt-1.5 whitespace-pre-line text-xs text-zinc-600 leading-relaxed">
                      {parkingInstructions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* House Manual */}
            {houseManual && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
                <h3 className="text-sm font-semibold text-[#1F1F1F]">House Manual</h3>
                <p className="mt-2 whitespace-pre-line text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  {houseManual}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

