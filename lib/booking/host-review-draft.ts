export const CLEANLINESS_FEEDBACK_TAGS = [
  "Neat & tidy",
  "Took care of the garbage",
  "Kept in good condition",
  "Something else",
] as const;

export type CleanlinessFeedbackTag = (typeof CLEANLINESS_FEEDBACK_TAGS)[number];

export const COMMUNICATION_FEEDBACK_TAGS = [
  "Helpful messages",
  "Always responded",
  "Respectful",
  "Something else",
] as const;

export type CommunicationFeedbackTag = (typeof COMMUNICATION_FEEDBACK_TAGS)[number];

export const CLEANLINESS_RATING_LABELS = [
  "",
  "Very poor",
  "Below expectations",
  "Acceptable",
  "Clean",
  "Extremely clean",
] as const;

export const HOUSE_RULES_RATING_LABELS = [
  "",
  "Did not follow rules",
  "Rarely followed rules",
  "Followed some rules",
  "Followed most rules",
  "Followed all rules",
] as const;

export const COMMUNICATION_RATING_LABELS = [
  "",
  "Very poorly",
  "Not very well",
  "Adequately",
  "Very well",
  "Extremely well",
] as const;

export const HOST_PUBLIC_REVIEW_MAX_LENGTH = 500;
export const HOST_PRIVATE_NOTE_MAX_LENGTH = 500;

export type HostReviewDraft = {
  bookingId: string;
  hostId: string;
  step: number;
  cleanlinessRating: number;
  cleanlinessTags: CleanlinessFeedbackTag[];
  houseRulesRating: number;
  communicationRating: number;
  communicationTags: CommunicationFeedbackTag[];
  publicReview: string;
  recommendGuest: boolean | null;
  privateNote: string;
};

export function isHostReviewRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isCleanlinessFeedbackTag(value: unknown): value is CleanlinessFeedbackTag {
  return typeof value === "string"
    && CLEANLINESS_FEEDBACK_TAGS.includes(value as CleanlinessFeedbackTag);
}

export function isCommunicationFeedbackTag(value: unknown): value is CommunicationFeedbackTag {
  return typeof value === "string"
    && COMMUNICATION_FEEDBACK_TAGS.includes(value as CommunicationFeedbackTag);
}

export function isHostPublicReviewText(value: unknown): value is string {
  return typeof value === "string" && value.length <= HOST_PUBLIC_REVIEW_MAX_LENGTH;
}

export function isHostRecommendation(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isHostPrivateNoteText(value: unknown): value is string {
  return typeof value === "string" && value.length <= HOST_PRIVATE_NOTE_MAX_LENGTH;
}

/**
 * Shared validation for the future host-review mutation. The current phases
 * only keep a local draft, so no server write or review record is created.
 */
export function validateHostReviewDraft(draft: Partial<Pick<HostReviewDraft,
  | "cleanlinessRating"
  | "cleanlinessTags"
  | "houseRulesRating"
  | "communicationRating"
  | "communicationTags"
  | "publicReview"
  | "recommendGuest"
  | "privateNote"
>>) {
  const result: Record<string, boolean> = {
    cleanlinessRating: isHostReviewRating(draft.cleanlinessRating),
    cleanlinessTags: Array.isArray(draft.cleanlinessTags) && draft.cleanlinessTags.every(isCleanlinessFeedbackTag),
    houseRulesRating: isHostReviewRating(draft.houseRulesRating),
    communicationRating: isHostReviewRating(draft.communicationRating),
    communicationTags: Array.isArray(draft.communicationTags) && draft.communicationTags.every(isCommunicationFeedbackTag),
    publicReview: isHostPublicReviewText(draft.publicReview),
  };
  if (draft.recommendGuest !== undefined || "recommendGuest" in draft) {
    result.recommendGuest = isHostRecommendation(draft.recommendGuest);
  }
  if (draft.privateNote !== undefined || "privateNote" in draft) {
    result.privateNote = isHostPrivateNoteText(draft.privateNote);
  }
  return result;
}

export type SubmitHostReviewInput = {
  bookingId: string;
  cleanlinessRating: number;
  cleanlinessTags?: CleanlinessFeedbackTag[];
  houseRulesRating: number;
  communicationRating: number;
  communicationTags?: CommunicationFeedbackTag[];
  publicReview?: string;
  recommendGuest: boolean;
  privateNote?: string;
};

export type HostReviewSubmissionValidation = {
  valid: boolean;
  errors: Record<string, string>;
  data?: {
    bookingId: string;
    cleanlinessRating: number;
    cleanlinessTags: CleanlinessFeedbackTag[];
    houseRulesRating: number;
    communicationRating: number;
    communicationTags: CommunicationFeedbackTag[];
    publicReview: string;
    recommendGuest: boolean;
    privateNote: string;
  };
};

export function validateHostReviewSubmission(input: unknown): HostReviewSubmissionValidation {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== "object") {
    return { valid: false, errors: { payload: "Invalid payload" } };
  }
  const payload = input as Record<string, unknown>;

  if (typeof payload.bookingId !== "string" || !payload.bookingId.trim()) {
    errors.bookingId = "Booking ID is required";
  }

  if (!isHostReviewRating(payload.cleanlinessRating)) {
    errors.cleanlinessRating = "Cleanliness rating must be between 1 and 5";
  }

  if (!isHostReviewRating(payload.houseRulesRating)) {
    errors.houseRulesRating = "House rules rating must be between 1 and 5";
  }

  if (!isHostReviewRating(payload.communicationRating)) {
    errors.communicationRating = "Communication rating must be between 1 and 5";
  }

  if (!isHostRecommendation(payload.recommendGuest)) {
    errors.recommendGuest = "Recommendation (Yes/No) is required";
  }

  let cleanlinessTags: CleanlinessFeedbackTag[] = [];
  if (payload.cleanlinessTags !== undefined) {
    if (!Array.isArray(payload.cleanlinessTags) || !payload.cleanlinessTags.every(isCleanlinessFeedbackTag)) {
      errors.cleanlinessTags = "Invalid cleanliness tags";
    } else {
      cleanlinessTags = payload.cleanlinessTags;
    }
  }

  let communicationTags: CommunicationFeedbackTag[] = [];
  if (payload.communicationTags !== undefined) {
    if (!Array.isArray(payload.communicationTags) || !payload.communicationTags.every(isCommunicationFeedbackTag)) {
      errors.communicationTags = "Invalid communication tags";
    } else {
      communicationTags = payload.communicationTags;
    }
  }

  let publicReview = "";
  if (payload.publicReview !== undefined) {
    if (!isHostPublicReviewText(payload.publicReview)) {
      errors.publicReview = `Public review must be at most ${HOST_PUBLIC_REVIEW_MAX_LENGTH} characters`;
    } else {
      publicReview = (payload.publicReview as string).trim();
    }
  }

  let privateNote = "";
  if (payload.privateNote !== undefined) {
    if (!isHostPrivateNoteText(payload.privateNote)) {
      errors.privateNote = `Private note must be at most ${HOST_PRIVATE_NOTE_MAX_LENGTH} characters`;
    } else {
      privateNote = (payload.privateNote as string).trim();
    }
  }

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    data: valid
      ? {
          bookingId: (payload.bookingId as string).trim(),
          cleanlinessRating: payload.cleanlinessRating as number,
          cleanlinessTags,
          houseRulesRating: payload.houseRulesRating as number,
          communicationRating: payload.communicationRating as number,
          communicationTags,
          publicReview,
          recommendGuest: payload.recommendGuest as boolean,
          privateNote,
        }
      : undefined,
  };
}
