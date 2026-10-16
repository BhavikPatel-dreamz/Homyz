import type { ReactNode } from "react";

type AosAnimation = "fade" | "fade-up" | "fade-down" | "fade-left" | "fade-right" | "zoom-in";

interface OnboardingStepHeadingProps {
  title: ReactNode;
  description?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
  titleAnimation?: AosAnimation;
  descriptionAnimation?: AosAnimation;
  descriptionDelay?: number;
}

/** A configurable heading/copy pair used by the form-oriented onboarding steps. */
export function OnboardingStepHeading({
  title,
  description,
  titleClassName,
  descriptionClassName,
  titleAnimation = "fade-up",
  descriptionAnimation = "fade-up",
  descriptionDelay = 100,
}: OnboardingStepHeadingProps) {
  return (
    <>
      <h1 data-aos={titleAnimation} className={titleClassName}>
        {title}
      </h1>
      {description && (
        <p
          data-aos={descriptionAnimation}
          data-aos-delay={String(descriptionDelay)}
          className={descriptionClassName}
        >
          {description}
        </p>
      )}
    </>
  );
}
