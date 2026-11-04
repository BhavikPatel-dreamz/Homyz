"use client";

import { useState } from "react";
import Image from "next/image";

type BrandLogoProps = {
  src?: string | null;
  fallbackSrc?: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

type ResolvedBrandLogoProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority: boolean;
};

/** A logo image with a reliable bundled fallback for malformed or unavailable remote media. */
export function BrandLogo({
  src,
  fallbackSrc = "/images/brand/homyz-logo-dark-v1.svg",
  alt = "Homyz",
  width = 199,
  height = 72,
  className,
  sizes,
  priority = false,
}: BrandLogoProps) {
  const desiredSrc = src || fallbackSrc;
  return <BrandLogoImage key={desiredSrc} src={desiredSrc} fallbackSrc={fallbackSrc} alt={alt} width={width} height={height} className={className} sizes={sizes} priority={priority} />;
}

function BrandLogoImage({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  className,
  sizes,
  priority,
}: ResolvedBrandLogoProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized
      onError={() => {
        if (resolvedSrc !== fallbackSrc) setResolvedSrc(fallbackSrc);
      }}
    />
  );
}
