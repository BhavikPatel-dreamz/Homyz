export const HOST_MESSAGE_MAX_LENGTH = 1000;

export type HostMessageValidation =
  | { valid: true; value: string }
  | { valid: false; error: string };

export function validateHostMessage(value: string): HostMessageValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: "Please write a message to the host." };
  }
  if (trimmed.length > HOST_MESSAGE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Your message must be ${HOST_MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`,
    };
  }
  return { valid: true, value: trimmed };
}

export function formatHostMessagePreview(value: string, maximumLength = 120): string {
  const trimmed = value.trim();
  if (trimmed.length <= maximumLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}
