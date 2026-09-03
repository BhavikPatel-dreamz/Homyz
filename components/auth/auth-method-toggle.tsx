import type { AuthMethod } from "./auth-form.types";

interface AuthMethodToggleProps {
  inputMethod: AuthMethod;
  onToggle: () => void;
}

export function AuthMethodToggle({ inputMethod, onToggle }: AuthMethodToggleProps) {
  return (
    <button type="button" onClick={onToggle} className="auth-action-button h-12 min-h-12 w-full rounded-[30px] bg-transparent py-0 hover:bg-[#F3F4F5] hover:text-[#1F1F1F] active:bg-[#F3F4F5] border border-[#727272] font-['Poppins'] font-medium text-[16px] leading-[24px] text-[#1F1F1F] transition-all flex items-center justify-center cursor-pointer select-none sm:h-[56px] sm:min-h-[56px] sm:text-[18px]">
      {inputMethod === "phone" ? "Continue with email" : "Continue with phone"}
    </button>
  );
}
