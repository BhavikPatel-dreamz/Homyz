"use client";

interface OnboardingCounterRowProps {
  label: string;
  value: number;
  minimum: number;
  onChange: (value: number) => void;
  valueClassName?: string;
}

/** A labelled increment/decrement control for onboarding capacity fields. */
export function OnboardingCounterRow({
  label,
  value,
  minimum,
  onChange,
  valueClassName = "font-normal",
}: OnboardingCounterRowProps) {
  return (
    <div className="flex items-center justify-between sm:py-4.5 py-4">
      <span className="text-lg font-medium text-[#1F1F1F]">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(minimum, value - 1))}
          disabled={value <= minimum}
          className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] disabled:opacity-30 disabled:hover:border-zinc-300 transition-colors text-base font-medium cursor-pointer"
        >
          -
        </button>
        <span className={`w-5 text-center text-lg ${valueClassName} text-[#1F1F1F] select-none`}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-700 hover:border-zinc-900 hover:text-[#1F1F1F] transition-colors text-base font-medium cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
}
