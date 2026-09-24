"use client";

import { useState } from "react";

type Props = {
  name: string;
  image?: string | null;
  isSuperhost: boolean;
  reviewCount: number;
  averageRating: number | null;
  tenure: string;
};

/** Matches the host summary card displayed on public listing pages. */
export function PublicHostIdentityCard({ name, image, isSuperhost, reviewCount, averageRating, tenure }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase() || "H";

  return (
    <div className="min-h-[260px] rounded-[10px] border border-[#dedede] bg-white px-7 py-7 shadow-[0_2px_5px_rgba(0,0,0,0.14)] transition-shadow hover:shadow-[0_5px_14px_rgba(0,0,0,0.14)] sm:rounded-[30px]">
      <div className="grid grid-cols-2 gap-x-7 gap-y-4">
        <div className="flex flex-col items-center justify-center text-center">
          {image && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- host avatars can be remote user media.
            <img src={image} alt="Host profile photo" loading="lazy" decoding="async" onError={() => setImageFailed(true)} className="size-[104px] shrink-0 rounded-full border border-zinc-200 object-cover" />
          ) : (
            <div aria-hidden="true" className="flex size-[104px] shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-2xl font-bold text-amber-900">{initial}</div>
          )}
          <div className="pt-4 text-center">
            <p className="break-words text-lg font-semibold capitalize text-[#1f1f1f] sm:text-[20px]">{name}</p>
            <p className="mt-1 text-base font-light text-[#1f1f1f] sm:mt-2">{isSuperhost ? "Superhost" : "Host"}</p>
          </div>
        </div>
        <div className="min-w-0 divide-y divide-[#dedede]">
          <div className="pb-4"><p className="text-lg font-normal leading-5 text-[#1f1f1f] sm:text-[20px]">{reviewCount || "—"}</p><p className="mt-1 text-xs font-normal text-[#727272]">Reviews</p></div>
          <div className="py-4"><p className="flex items-center gap-1 text-lg font-normal leading-5 text-[#1f1f1f] sm:text-[20px]">{averageRating?.toFixed(2) ?? "—"}<span className="text-[#e9a400]">★</span></p><p className="mt-2 text-xs font-normal text-[#727272]">Rating</p></div>
          <div className="pt-4"><p className="text-base font-normal leading-5 text-[#1f1f1f] sm:text-[20px]">{tenure}</p><p className="mt-2 text-xs font-normal text-[#727272]">time hosting</p></div>
        </div>
      </div>
    </div>
  );
}
