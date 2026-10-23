import type { ComponentProps, MouseEventHandler } from "react";
import Link from "next/link";

export type BackButtonProps = Omit<ComponentProps<"button">, "children" | "onClick"> & {
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
};

export function BackButton({
  className = "",
  type = "button",
  "aria-label": ariaLabel = "Go back",
  href,
  ...props
}: BackButtonProps) {
  const buttonClasses = `flex w-7.5 h-7.5 shrink-0 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] items-center justify-center text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white text-sm transition-all cursor-pointer focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50 group dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:hover:text-white ${className}`.trim();

  const icon = (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="group-hover:stroke-white dark:group-hover:stroke-white"
      />
    </svg>
  );

  if (href) {
    const { onClick, id, title } = props;
    return (
      <Link
        href={href}
        id={id}
        title={title}
        aria-label={ariaLabel}
        className={buttonClasses}
        onClick={onClick}
      >
        {icon}
      </Link>
    );
  }

  return (
    <button
      {...props}
      type={type}
      aria-label={ariaLabel}
      className={buttonClasses}
    >
      {icon}
    </button>
  );
}
