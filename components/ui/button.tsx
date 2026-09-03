import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "upload";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leadingIcon?: ReactNode;
}

export const primaryButtonInteractionClass = "border border-transparent hover:border-[#1F1F1F] hover:bg-[#F3F4F5] hover:text-[#1F1F1F]";
const baseClass = `box-border inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium text-[#1F1F1F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3CFFC] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 ${primaryButtonInteractionClass}`;

const variantClasses: Record<ButtonVariant, string> = {
  primary: "min-h-12 bg-[#FCDF9C] px-6 py-4 text-lg leading-6 active:border-[#1F1F1F] active:bg-[#F3F4F5]",
  upload: "min-h-14 border-[#1F1F1F] bg-[#D9D9D9] px-12 py-4 text-lg leading-[23px] active:border-[#EBA900] active:bg-[#FCDF9C]",
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
