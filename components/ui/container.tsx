import type { HTMLAttributes } from "react";

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "main" | "section";
}

export function Container({ as: Component = "div", className = "", ...props }: ContainerProps) {
  return <Component className={`mx-auto box-border w-full max-w-[1600px] px-6 ${className}`.trim()} {...props} />;
}
