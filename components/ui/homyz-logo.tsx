"use client";

import React from "react";

export interface HomyzLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function HomyzLogo({ size = 28, className = "", ...props }: HomyzLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Figure Head / Dot above arch */}
      <circle cx="9.5" cy="5.5" r="2.6" fill="currentColor" stroke="none" />
      
      {/* Arch roof curve */}
      <path d="M 3 22 C 7.5 14, 16 8.5, 30 9.5" />
      
      {/* Left leg */}
      <path d="M 9.5 18 V 31" />
      
      {/* Right leg */}
      <path d="M 24 1.5 V 31" />
    </svg>
  );
}

export function HomyzBrandLogo({
  className = "",
  textClassName = "text-xl font-extrabold tracking-tight text-zinc-900",
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <HomyzLogo className="text-zinc-950 shrink-0" size={28} />
      <span className={textClassName}>homyz</span>
    </div>
  );
}
