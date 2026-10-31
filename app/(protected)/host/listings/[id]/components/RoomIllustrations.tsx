import React from "react";

interface RoomIllustrationProps {
  type: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function RoomIllustration({ type, className = "", size = "md" }: RoomIllustrationProps) {
  const norm = (type || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");

  const width = size === "sm" ? 36 : size === "lg" ? 140 : 72;
  const height = size === "sm" ? 28 : size === "lg" ? 105 : 54;

  // 1. DINING_ROOM / DINING_AREA
  if (norm.includes("DINING")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        {/* Shadow */}
        <ellipse cx="50" cy="62" rx="36" ry="10" fill="#000" fillOpacity="0.06" />
        {/* Table Top */}
        <path d="M22 36 L78 36 L68 54 L32 54 Z" fill="#9A7B56" />
        <path d="M24 38 L76 38 L67 52 L33 52 Z" fill="#B8976C" />
        {/* Table Legs */}
        <rect x="33" y="52" width="3" height="15" rx="1.5" fill="#755835" />
        <rect x="64" y="52" width="3" height="15" rx="1.5" fill="#755835" />
        <rect x="25" y="40" width="3" height="23" rx="1.5" fill="#886842" />
        <rect x="72" y="40" width="3" height="23" rx="1.5" fill="#886842" />
        {/* Chairs back */}
        <rect x="18" y="24" width="8" height="16" rx="2" fill="#586E53" />
        <rect x="74" y="24" width="8" height="16" rx="2" fill="#586E53" />
        <rect x="36" y="22" width="10" height="14" rx="2" fill="#43563F" />
        <rect x="54" y="22" width="10" height="14" rx="2" fill="#43563F" />
        {/* Chairs front */}
        <rect x="34" y="46" width="12" height="18" rx="2" fill="#627B5C" />
        <rect x="54" y="46" width="12" height="18" rx="2" fill="#627B5C" />
        {/* Centerpiece Vase & Flower */}
        <rect x="47" y="32" width="6" height="8" rx="2" fill="#E86C60" />
        <circle cx="50" cy="30" r="3" fill="#F8A59C" />
      </svg>
    );
  }

  // 2. BEDROOM
  if (norm.includes("BED")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        {/* Shadow */}
        <ellipse cx="50" cy="62" rx="34" ry="9" fill="#000" fillOpacity="0.06" />
        {/* Headboard */}
        <rect x="24" y="22" width="52" height="22" rx="4" fill="#A47E53" />
        <rect x="27" y="24" width="46" height="18" rx="2" fill="#BFA077" />
        {/* Pillows */}
        <rect x="30" y="28" width="18" height="10" rx="3" fill="#FFFFFF" stroke="#E2E2E2" strokeWidth="1" />
        <rect x="52" y="28" width="18" height="10" rx="3" fill="#FFFFFF" stroke="#E2E2E2" strokeWidth="1" />
        {/* Mattress & Sheet */}
        <path d="M26 38 L74 38 L78 60 L22 60 Z" fill="#F3E9DD" />
        {/* Duvet / Blanket */}
        <path d="M24 44 L76 44 L78 60 L22 60 Z" fill="#E8826B" />
        <path d="M22 60 L78 60 L76 64 L24 64 Z" fill="#C4654F" />
        {/* Runner */}
        <path d="M23 54 L77 54 L78 58 L22 58 Z" fill="#D2705B" />
        {/* Legs */}
        <rect x="23" y="63" width="4" height="6" rx="1.5" fill="#755835" />
        <rect x="73" y="63" width="4" height="6" rx="1.5" fill="#755835" />
      </svg>
    );
  }

  // 3. BATHROOM
  if (norm.includes("BATH")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        {/* Shadow */}
        <ellipse cx="50" cy="62" rx="32" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Bathtub body */}
        <path d="M25 36 C25 36 28 58 50 58 C72 58 75 36 75 36 Z" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1.5" />
        {/* Inside water */}
        <path d="M28 40 C32 48 68 48 72 40 Z" fill="#A5D8E8" />
        {/* Tub feet */}
        <circle cx="34" cy="58" r="3" fill="#B3B3B3" />
        <circle cx="66" cy="58" r="3" fill="#B3B3B3" />
        {/* Bubbles */}
        <circle cx="44" cy="38" r="4" fill="#E0F2FE" />
        <circle cx="52" cy="36" r="5" fill="#E0F2FE" />
        <circle cx="59" cy="39" r="3" fill="#E0F2FE" />
        {/* Faucet */}
        <path d="M72 24 L72 34" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M72 24 L67 24" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" />
        {/* Bath mat */}
        <rect x="36" y="64" width="28" height="6" rx="2" fill="#88D4B0" />
      </svg>
    );
  }

  // 4. LIVING_ROOM / FAMILY_ROOM
  if (norm.includes("LIVING") || norm.includes("FAMILY")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        {/* Shadow */}
        <ellipse cx="50" cy="62" rx="36" ry="9" fill="#000" fillOpacity="0.06" />
        {/* Sofa Backrest */}
        <rect x="20" y="26" width="60" height="22" rx="5" fill="#D68662" />
        {/* Armrests */}
        <rect x="18" y="34" width="10" height="24" rx="4" fill="#C47350" />
        <rect x="72" y="34" width="10" height="24" rx="4" fill="#C47350" />
        {/* Seat Cushions */}
        <rect x="28" y="38" width="22" height="16" rx="3" fill="#E29672" />
        <rect x="50" y="38" width="22" height="16" rx="3" fill="#E29672" />
        {/* Throw Pillow */}
        <rect x="30" y="32" width="10" height="10" rx="2" transform="rotate(-15 30 32)" fill="#FEE2B3" />
        {/* Sofa Legs */}
        <rect x="24" y="58" width="4" height="6" rx="1.5" fill="#6B4B32" />
        <rect x="72" y="58" width="4" height="6" rx="1.5" fill="#6B4B32" />
        {/* Coffee Table */}
        <ellipse cx="50" cy="62" rx="16" ry="6" fill="#F4EDE4" stroke="#D1C4B5" strokeWidth="1" />
      </svg>
    );
  }

  // 5. KITCHEN
  if (norm.includes("KITCHEN")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="64" rx="34" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Base Counter */}
        <rect x="22" y="36" width="56" height="26" rx="3" fill="#E5E7EB" />
        {/* Counter Top */}
        <rect x="20" y="33" width="60" height="5" rx="1.5" fill="#4B5563" />
        {/* Cabinets / Stove */}
        <rect x="26" y="42" width="22" height="16" rx="2" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1" />
        <rect x="52" y="42" width="22" height="16" rx="2" fill="#1F2937" />
        <circle cx="63" cy="50" r="4" fill="#374151" />
        {/* Pan on Stove */}
        <ellipse cx="36" cy="32" rx="6" ry="2" fill="#111827" />
        <line x1="42" y1="32" x2="48" y2="28" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
        {/* Floating Shelf */}
        <rect x="28" y="18" width="44" height="3" rx="1" fill="#9CA3AF" />
        <rect x="34" y="11" width="5" height="7" rx="1" fill="#F87171" />
        <rect x="42" y="9" width="4" height="9" rx="1" fill="#60A5FA" />
      </svg>
    );
  }

  // 6. SWIMMING_POOL / POOL_HOT_TUB
  if (norm.includes("POOL") || norm.includes("HOT_TUB") || norm.includes("SPA")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="36" ry="9" fill="#000" fillOpacity="0.06" />
        {/* Pool Coping Edge */}
        <path d="M18 36 C18 24 82 24 82 36 C82 56 18 56 18 36 Z" fill="#E5E7EB" />
        {/* Pool Water */}
        <path d="M22 36 C22 27 78 27 78 36 C78 52 22 52 22 36 Z" fill="#38BDF8" />
        {/* Water Highlights */}
        <path d="M30 38 Q38 35 46 38 T62 38" stroke="#BAE6FD" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M38 45 Q46 42 54 45 T70 45" stroke="#BAE6FD" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Ladder */}
        <path d="M68 28 L68 40 M72 28 L72 40 M68 32 L72 32 M68 36 L72 36" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // 7. BALCONY / PATIO / TERRACE
  if (norm.includes("BALCONY") || norm.includes("PATIO") || norm.includes("TERRACE")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="64" rx="36" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Deck flooring */}
        <path d="M20 44 L80 44 L86 64 L14 64 Z" fill="#C89D7C" />
        {/* Deck lines */}
        <line x1="32" y1="44" x2="28" y2="64" stroke="#A77A57" strokeWidth="1" />
        <line x1="44" y1="44" x2="42" y2="64" stroke="#A77A57" strokeWidth="1" />
        <line x1="56" y1="44" x2="58" y2="64" stroke="#A77A57" strokeWidth="1" />
        <line x1="68" y1="44" x2="72" y2="64" stroke="#A77A57" strokeWidth="1" />
        {/* Balcony Railing */}
        <rect x="18" y="24" width="64" height="4" rx="1.5" fill="#475569" />
        <rect x="22" y="28" width="3" height="16" fill="#64748B" />
        <rect x="36" y="28" width="3" height="16" fill="#64748B" />
        <rect x="50" y="28" width="3" height="16" fill="#64748B" />
        <rect x="64" y="28" width="3" height="16" fill="#64748B" />
        <rect x="76" y="28" width="3" height="16" fill="#64748B" />
        {/* Potted Plant */}
        <rect x="68" y="46" width="10" height="10" rx="2" fill="#D97706" />
        <circle cx="73" cy="42" r="6" fill="#16A34A" />
      </svg>
    );
  }

  // 8. GARDEN / BACKYARD
  if (norm.includes("GARDEN") || norm.includes("BACKYARD") || norm.includes("COURTYARD")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="36" ry="10" fill="#000" fillOpacity="0.06" />
        {/* Lawn Base */}
        <path d="M16 48 C24 38 76 38 84 48 C84 62 16 62 16 48 Z" fill="#86EFAC" />
        {/* Tree Trunk & Crown */}
        <rect x="32" y="32" width="6" height="20" rx="2" fill="#78350F" />
        <circle cx="35" cy="26" r="14" fill="#22C55E" />
        <circle cx="42" cy="22" r="10" fill="#16A34A" />
        {/* Garden Bench */}
        <rect x="54" y="38" width="22" height="4" rx="1" fill="#B45309" />
        <rect x="56" y="42" width="3" height="12" fill="#78350F" />
        <rect x="71" y="42" width="3" height="12" fill="#78350F" />
        {/* Flowers */}
        <circle cx="24" cy="50" r="3" fill="#F43F5E" />
        <circle cx="50" cy="52" r="2.5" fill="#EAB308" />
        <circle cx="76" cy="50" r="3" fill="#EC4899" />
      </svg>
    );
  }

  // 9. WORKSPACE
  if (norm.includes("WORK") || norm.includes("STUDY") || norm.includes("OFFICE")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="34" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Desk Surface */}
        <rect x="22" y="38" width="56" height="6" rx="2" fill="#D4A373" />
        {/* Desk Legs */}
        <rect x="26" y="44" width="4" height="18" fill="#582F0E" />
        <rect x="70" y="44" width="4" height="18" fill="#582F0E" />
        {/* Laptop / Monitor */}
        <rect x="42" y="24" width="20" height="13" rx="2" fill="#1E293B" />
        <rect x="44" y="26" width="16" height="9" rx="1" fill="#38BDF8" />
        <rect x="49" y="37" width="6" height="2" fill="#94A3B8" />
        {/* Desk Lamp */}
        <path d="M30 38 L34 26 L38 28" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M36 24 L42 27 L38 30 Z" fill="#F59E0B" />
        {/* Chair */}
        <rect x="44" y="44" width="12" height="14" rx="2" fill="#475569" />
        <rect x="48" y="58" width="4" height="6" fill="#334155" />
      </svg>
    );
  }

  // 10. ART_STUDIO
  if (norm.includes("ART") || norm.includes("STUDIO")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="64" rx="34" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Easel Tripod */}
        <line x1="50" y1="18" x2="32" y2="64" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="18" x2="68" y2="64" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="18" x2="50" y2="62" stroke="#78350F" strokeWidth="2.5" />
        {/* Canvas */}
        <rect x="34" y="24" width="32" height="24" rx="2" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
        {/* Painting Artwork */}
        <path d="M38 42 C42 34 50 36 54 32 C58 28 62 38 62 44 Z" fill="#F43F5E" />
        <circle cx="44" cy="30" r="4" fill="#FBBF24" />
        {/* Color Palette on Stool */}
        <ellipse cx="26" cy="52" rx="8" ry="5" fill="#FDE68A" />
        <circle cx="23" cy="51" r="1.5" fill="#EF4444" />
        <circle cx="26" cy="50" r="1.5" fill="#3B82F6" />
        <circle cx="29" cy="52" r="1.5" fill="#10B981" />
      </svg>
    );
  }

  // 11. GYM
  if (norm.includes("GYM") || norm.includes("FITNESS")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="32" ry="7" fill="#000" fillOpacity="0.06" />
        {/* Gym Mat */}
        <path d="M20 48 L76 48 L82 62 L16 62 Z" fill="#3B82F6" />
        {/* Barbell / Dumbbells */}
        <rect x="36" y="36" width="30" height="4" rx="2" fill="#94A3B8" />
        <rect x="32" y="30" width="6" height="16" rx="2" fill="#1E293B" />
        <rect x="64" y="30" width="6" height="16" rx="2" fill="#1E293B" />
        <rect x="29" y="32" width="3" height="12" rx="1" fill="#475569" />
        <rect x="70" y="32" width="3" height="12" rx="1" fill="#475569" />
        {/* Kettlebell */}
        <circle cx="74" cy="52" r="6" fill="#0F172A" />
        <path d="M71 46 C71 42 77 42 77 46" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  // 12. GAME_ROOM / MEDIA
  if (norm.includes("GAME") || norm.includes("MEDIA") || norm.includes("BOWLING")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="34" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Bowling Lane / Table */}
        <path d="M22 42 L78 42 L84 62 L16 62 Z" fill="#FBBF24" />
        {/* Bowling Pins */}
        <circle cx="68" cy="46" r="2.5" fill="#FFFFFF" stroke="#EF4444" strokeWidth="1" />
        <circle cx="74" cy="46" r="2.5" fill="#FFFFFF" stroke="#EF4444" strokeWidth="1" />
        <circle cx="71" cy="43" r="2.5" fill="#FFFFFF" stroke="#EF4444" strokeWidth="1" />
        {/* Bowling Ball */}
        <circle cx="36" cy="52" r="7" fill="#047857" />
        <circle cx="34" cy="50" r="1" fill="#FFFFFF" />
        <circle cx="37" cy="49" r="1" fill="#FFFFFF" />
        <circle cx="36" cy="53" r="1" fill="#FFFFFF" />
      </svg>
    );
  }

  // 13. LAUNDRY
  if (norm.includes("LAUNDRY")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="30" ry="7" fill="#000" fillOpacity="0.06" />
        {/* Washing machine body */}
        <rect x="32" y="22" width="36" height="40" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
        {/* Controls */}
        <line x1="38" y1="28" x2="48" y2="28" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="28" r="2.5" fill="#3B82F6" />
        {/* Door Glass */}
        <circle cx="50" cy="46" r="12" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" />
        <circle cx="50" cy="46" r="8" fill="#38BDF8" fillOpacity="0.6" />
        {/* Laundry basket */}
        <rect x="18" y="44" width="12" height="14" rx="2" fill="#E2E8F0" />
      </svg>
    );
  }

  // 14. GARAGE / PARKING
  if (norm.includes("GARAGE") || norm.includes("PARK")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="36" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Car Silhouette */}
        <path d="M24 54 C24 48 30 46 36 44 L44 34 C48 31 62 31 66 34 L74 44 C80 46 84 48 84 54 L84 58 L24 58 Z" fill="#3B82F6" />
        {/* Windshield */}
        <path d="M44 36 L64 36 L70 44 L40 44 Z" fill="#93C5FD" />
        {/* Wheels */}
        <circle cx="36" cy="58" r="6" fill="#1E293B" />
        <circle cx="36" cy="58" r="2.5" fill="#94A3B8" />
        <circle cx="72" cy="58" r="6" fill="#1E293B" />
        <circle cx="72" cy="58" r="2.5" fill="#94A3B8" />
      </svg>
    );
  }

  // 15. EXTERIOR / VIEW
  if (norm.includes("EXTERIOR") || norm.includes("VIEW") || norm.includes("BEACH") || norm.includes("MOUNTAIN")) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="62" rx="36" ry="8" fill="#000" fillOpacity="0.06" />
        {/* Mountains / Landscape */}
        <path d="M16 54 L36 30 L54 54 Z" fill="#94A3B8" />
        <path d="M42 54 L62 24 L84 54 Z" fill="#64748B" />
        <path d="M36 30 L40 36 L32 36 Z" fill="#F8FAFC" />
        <path d="M62 24 L68 32 L56 32 Z" fill="#F8FAFC" />
        {/* Sun */}
        <circle cx="34" cy="22" r="7" fill="#FBBF24" />
      </svg>
    );
  }

  // 16. ADDITIONAL_PHOTOS / UNASSIGNED (Stack of Photos)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="50" cy="64" rx="34" ry="8" fill="#000" fillOpacity="0.06" />
      {/* Photo Frame 1 (Rotated) */}
      <rect
        x="24"
        y="24"
        width="46"
        height="34"
        rx="3"
        transform="rotate(-8 24 24)"
        fill="#FFFFFF"
        stroke="#E2E8F0"
        strokeWidth="1.5"
      />
      <rect
        x="28"
        y="27"
        width="38"
        height="24"
        rx="2"
        transform="rotate(-8 28 27)"
        fill="#E0E7FF"
      />
      {/* Photo Frame 2 (Front) */}
      <rect x="30" y="24" width="46" height="34" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
      <rect x="33" y="27" width="40" height="24" rx="2" fill="#F8FAFC" />
      {/* Mountain & Sun graphic inside frame */}
      <path d="M37 47 L49 35 L61 47 Z" fill="#CBD5E1" />
      <path d="M53 47 L61 39 L69 47 Z" fill="#94A3B8" />
      <circle cx="45" cy="33" r="3" fill="#FBBF24" />
    </svg>
  );
}

