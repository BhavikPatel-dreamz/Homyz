import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "destructive" | "upload";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leadingIcon?: ReactNode;
}

export const primaryButtonInteractionClass = "border border-transparent hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white";
const baseClass = `box-border inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${primaryButtonInteractionClass}`;

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[#FCDF9C] text-[#1F1F1F] active:border-[#1F1F1F] active:bg-[#F3F4F5] dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white",
  secondary: "bg-[#F3F4F5] text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  outline: "border border-zinc-300 bg-white text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
  destructive: "bg-rose-600 text-white hover:bg-rose-700 border-transparent",
  upload: "border border-[#1F1F1F] bg-[#D9D9D9] text-[#1F1F1F] active:border-[#FCDF9C] active:bg-[#FCDF9C]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8.5 min-h-[34px] px-3.5 text-xs sm:text-sm",
  md: "h-10.5 min-h-[42px] px-5 text-sm",
  lg: "h-12 min-h-12 px-6 text-sm sm:text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "lg",
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
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...props}
    >
      {!isLoading && leadingIcon}
      {isLoading ? loadingText : children}
    </button>
  );
});
