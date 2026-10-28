import type { SuperhostEligibilityStatus } from "@/lib/superhost/rules";

export interface SuperhostLifecycleInput {
  previousOfficialStatus: boolean;
  previousQualifiedAt: Date | null;
  eligibilityStatus: SuperhostEligibilityStatus;
  eligibleNow: boolean;
  checkpoint: Date;
}

export interface SuperhostLifecycleTransition {
  /** Whether this assessment is conclusive enough to change the public badge. */
  appliesOfficialStatus: boolean;
  officialStatus: boolean;
  qualifiedAt: Date | null;
}

/**
 * Applies only lifecycle policy already represented by the quarterly status
 * fields. A blocked qualification result is deliberately not a failed
 * qualification: there is no approved rule permitting an earned badge to be
 * revoked because required data or policy is unresolved.
 */
export function resolveSuperhostLifecycleTransition(
  input: SuperhostLifecycleInput,
): SuperhostLifecycleTransition {
  if (input.eligibilityStatus === "CANNOT_DETERMINE") {
    return {
      appliesOfficialStatus: false,
      officialStatus: input.previousOfficialStatus,
      qualifiedAt: input.previousQualifiedAt,
    };
  }

  if (input.eligibilityStatus === "ELIGIBLE" && input.eligibleNow) {
    return {
      appliesOfficialStatus: true,
      officialStatus: true,
      qualifiedAt: input.previousQualifiedAt ?? input.checkpoint,
    };
  }

  return {
    appliesOfficialStatus: true,
    officialStatus: false,
    qualifiedAt: null,
  };
}
