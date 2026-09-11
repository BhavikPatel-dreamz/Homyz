"use client";

import Image from "next/image";

interface AmenityOption {
  id: string;
  label: string;
}

interface OnboardingAmenitySectionProps {
  title: string;
  items: AmenityOption[];
  selectedIds: string[];
  iconPaths: Record<string, string>;
  onToggle: (id: string) => void;
  animationDelay: number;
}

/** A titled, multi-select amenity grid used by the amenities onboarding step. */
export function OnboardingAmenitySection({
  title,
  items,
  selectedIds,
  iconPaths,
  onToggle,
  animationDelay,
}: OnboardingAmenitySectionProps) {
  return (
    <section data-aos="fade-up" data-aos-delay={String(animationDelay)}>
      <h3 className="text-lg font-medium text-[#1F1F1F] mb-4">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 sm:gap-3.5 gap-2 w-full">
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`flex items-center gap-3 px-3.25 sm:py-3.25 py-3 rounded-lg border sm:text-base text-sm sm:font-medium font-normal transition-all cursor-pointer select-none text-left ${isSelected
                ? "bg-[#E9EBFF] text-[#1F1F1F]"
                : "bg-white text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-[#E9EBFF]"
                }`}
            >
              <div className="w-10 h-10 rounded-full border border-[#1F1F1F] flex items-center justify-center shrink-0 transition-colors">
                <Image
                  src={iconPaths[item.id]}
                  alt=""
                  aria-hidden="true"
                  width={24}
                  height={24}
                  unoptimized
                  className="h-6 w-6 object-contain"
                />
              </div>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
