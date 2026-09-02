import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "upload";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leadingIcon?: ReactNode;
}

const baseClass = "box-border inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium text-[#1F1F1F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3CFFC] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-[#1F1F1F] disabled:hover:border-[#1F1F1F]";
export const primaryButtonInteractionClass = "hover:bg-[#1F1F1F] hover:text-white active:bg-[#1F1F1F] active:text-white";

const variantClasses: Record<ButtonVariant, string> = {
  primary: `min-h-12 bg-[#FCDF9C] px-6 py-4 text-base leading-6 ${primaryButtonInteractionClass}`,
  upload: "min-h-14 border border-[#1F1F1F] bg-[#D9D9D9] px-12 py-4 text-lg leading-[23px] hover:bg-[#FCDF9C] active:border-[#EBA900] active:bg-[#FCDF9C]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    fullWidth = false,
    isLoading = false,
    loadingText = "Please wait...",
    leadingIcon,
    className = "",
    children,
    disabled,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || isLoading} aria-busy={isLoading || undefined} className={`${baseClass} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`.trim()} {...props}>
      {!isLoading && leadingIcon}
      {isLoading ? loadingText : children}
    </button>
  );
});
