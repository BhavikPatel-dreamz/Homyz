import type { SVGProps } from "react";

export type ReviewIconName =
  | "star"
  | "cleanliness"
  | "accuracy"
  | "checkIn"
  | "communication"
  | "location"
  | "value"
  | "topic"
  | "pool"
  | "hospitality"
  | "condition"
  | "comfort"
  | "family"
  | "view"
  | "kitchen"
  | "parking"
  | "wifi"
  | "bed"
  | "indoorSpaces"
  | "search"
  | "close"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "filter";

export function getMentionIconName(topic: string): ReviewIconName {
  const normalized = topic.toLowerCase().trim();
  if (normalized.includes("pool") || normalized.includes("swim")) return "pool";
  if (normalized.includes("hospit") || normalized.includes("host") || normalized.includes("welcom")) return "hospitality";
  if (normalized.includes("clean") || normalized.includes("spotless")) return "cleanliness";
  if (normalized.includes("condition") || normalized.includes("maintain") || normalized.includes("renovat")) return "condition";
  if (normalized.includes("comfort") || normalized.includes("cozy") || normalized.includes("cosy")) return "comfort";
  if (normalized.includes("famil") || normalized.includes("kid") || normalized.includes("child")) return "family";
  if (normalized.includes("accura") || normalized.includes("described")) return "accuracy";
  if (normalized.includes("locat") || normalized.includes("neighborhood") || normalized.includes("area")) return "location";
  if (normalized.includes("view") || normalized.includes("scener") || normalized.includes("balcon")) return "view";
  if (normalized.includes("kitchen") || normalized.includes("cook")) return "kitchen";
  if (normalized.includes("park") || normalized.includes("garage")) return "parking";
  if (normalized.includes("wi-fi") || normalized.includes("wifi") || normalized.includes("internet")) return "wifi";
  if (normalized.includes("bed") || normalized.includes("mattress") || normalized.includes("sleep")) return "bed";
  if (normalized.includes("indoor") || normalized.includes("space") || normalized.includes("living")) return "indoorSpaces";
  if (normalized.includes("check-in") || normalized.includes("check in") || normalized.includes("arrival")) return "checkIn";
  if (normalized.includes("communi") || normalized.includes("respons")) return "communication";
  if (normalized.includes("value") || normalized.includes("price") || normalized.includes("worth")) return "value";
  return "topic";
}

export function ReviewIcon({ name, ...props }: { name: ReviewIconName } & SVGProps<SVGSVGElement>) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "star") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m12 2.8 2.84 5.76 6.36.92-4.6 4.49 1.09 6.34L12 17.33 6.31 20.3l1.09-6.34-4.6-4.49 6.36-.92L12 2.8Z" {...common} /></svg>;
  if (name === "cleanliness") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M7 21h10M9 21l1-8h4l1 8M10 13V8a2 2 0 0 1 4 0v5M8.5 5.5l-1-1M15.5 5.5l1-1M7 9H5.5M18.5 9H17" {...common} /></svg>;
  if (name === "accuracy") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="12" cy="12" r="8.5" {...common} /><path d="m8.6 12.1 2.25 2.25 4.7-5" {...common} /></svg>;
  if (name === "checkIn") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="8.5" cy="15.5" r="2.5" {...common} /><path d="M11 14h8m-3 0v3m-3-3v2M6 13V5h11v7M4 5h15" {...common} /></svg>;
  if (name === "communication") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1.25 0-2.43-.3-3.46-.84L4 19.5l1.34-4.03A7.46 7.46 0 0 1 5 13a7.5 7.5 0 0 1 15-1.5Z" {...common} /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" {...common} /></svg>;
  if (name === "location") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z" {...common} /><circle cx="12" cy="10" r="2.25" {...common} /></svg>;
  if (name === "value") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M20 13.5 13.5 20a2 2 0 0 1-2.83 0L4 13.33V5h8.33L20 10.67a2 2 0 0 1 0 2.83Z" {...common} /><circle cx="8.5" cy="8.5" r="1" {...common} /></svg>;

  // Mention and utility icons
  if (name === "pool") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M2 18c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1M2 21c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm4.5-1.5 4-4 2 2" {...common} /></svg>;
  if (name === "hospitality") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" {...common} /></svg>;
  if (name === "condition") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" {...common} /><path d="m9 12 2 2 4-4" {...common} /></svg>;
  if (name === "comfort") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M4 11V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M4 11a3 3 0 0 0-2 2.8v3.4A1.8 1.8 0 0 0 3.8 19H5M20 11a3 3 0 0 1 2 2.8v3.4a1.8 1.8 0 0 1-1.8 1.8H19M5 19v2M19 19v2M4 14h16" {...common} /></svg>;
  if (name === "family") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="9" cy="7" r="4" {...common} /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" {...common} /></svg>;
  if (name === "view") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m2 18 7-9 5 6 3-3 5 6H2Z" {...common} /><circle cx="17" cy="6" r="2" {...common} /></svg>;
  if (name === "kitchen") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M18 2v20M6 2v7a3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V2M9 12v10" {...common} /></svg>;
  if (name === "parking") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect width="18" height="18" x="3" y="3" rx="4" {...common} /><path d="M9 17V7h4a3 3 0 0 1 0 6H9" {...common} /></svg>;
  if (name === "wifi") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" {...common} /></svg>;
  if (name === "bed") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v3" {...common} /></svg>;
  if (name === "indoorSpaces") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect width="18" height="18" x="3" y="3" rx="2" {...common} /><path d="M3 9h18M9 21V9" {...common} /></svg>;
  if (name === "search") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="11" cy="11" r="8" {...common} /><path d="m21 21-4.3-4.3" {...common} /></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M18 6 6 18M6 6l12 12" {...common} /></svg>;
  if (name === "chevronDown") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m6 9 6 6 6-6" {...common} /></svg>;
  if (name === "chevronLeft") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m15 18-6-6 6-6" {...common} /></svg>;
  if (name === "chevronRight") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m9 18 6-6-6-6" {...common} /></svg>;
  if (name === "filter") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" {...common} /></svg>;

  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M6 12h12M12 6v12" {...common} /></svg>;
}
