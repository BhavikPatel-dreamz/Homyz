import type { AuthMethod } from "./auth-form.types";

interface AuthMethodToggleProps {
  inputMethod: AuthMethod;
  onToggle: () => void;
}

export function AuthMethodToggle({ inputMethod, onToggle }: AuthMethodToggleProps) {
  return (
    <button type="button" onClick={onToggle} className="w-full h-[54px] sm:h-[56px] rounded-[30px] bg-transparent hover:bg-[#1F1F1F] hover:text-white active:bg-[#1F1F1F] active:text-white border border-[#1F1F1F] font-['Poppins'] font-medium text-[15px] sm:text-[18px] leading-[23px] text-[#1F1F1F] transition-all flex items-center justify-center cursor-pointer select-none">
      {inputMethod === "phone" ? "Continue with email" : "Continue with phone"}
    </button>
  );
}
