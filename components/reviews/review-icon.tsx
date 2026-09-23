import type { SVGProps } from "react";

export type ReviewIconName =
  | "star"
  | "cleanliness"
  | "accuracy"
  | "checkIn"
  | "communication"
  | "location"
  | "value"
  | "topic";

export function ReviewIcon({ name, ...props }: { name: ReviewIconName } & SVGProps<SVGSVGElement>) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "star") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="m12 2.8 2.84 5.76 6.36.92-4.6 4.49 1.09 6.34L12 17.33 6.31 20.3l1.09-6.34-4.6-4.49 6.36-.92L12 2.8Z" {...common} /></svg>;
  if (name === "cleanliness") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M7 21h10M9 21l1-8h4l1 8M10 13V8a2 2 0 0 1 4 0v5M8.5 5.5l-1-1M15.5 5.5l1-1M7 9H5.5M18.5 9H17" {...common} /></svg>;
  if (name === "accuracy") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="12" cy="12" r="8.5" {...common} /><path d="m8.6 12.1 2.25 2.25 4.7-5" {...common} /></svg>;
  if (name === "checkIn") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="8.5" cy="15.5" r="2.5" {...common} /><path d="M11 14h8m-3 0v3m-3-3v2M6 13V5h11v7M4 5h15" {...common} /></svg>;
  if (name === "communication") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1.25 0-2.43-.3-3.46-.84L4 19.5l1.34-4.03A7.46 7.46 0 0 1 5 13a7.5 7.5 0 0 1 15-1.5Z" {...common} /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" {...common} /></svg>;
  if (name === "location") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z" {...common} /><circle cx="12" cy="10" r="2.25" {...common} /></svg>;
  if (name === "value") return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M20 13.5 13.5 20a2 2 0 0 1-2.83 0L4 13.33V5h8.33L20 10.67a2 2 0 0 1 0 2.83Z" {...common} /><circle cx="8.5" cy="8.5" r="1" {...common} /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M6 12h12M12 6v12" {...common} /></svg>;
}
