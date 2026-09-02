import type { HTMLAttributes } from "react";

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "main" | "section";
}

export function Container({ as: Component = "div", className = "", ...props }: ContainerProps) {
  return <Component className={`mx-auto box-border w-full max-w-[1520px] px-4 sm:px-6 lg:px-10 ${className}`.trim()} {...props} />;
}
