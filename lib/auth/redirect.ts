/**
 * Safe Redirect URL Sanitization for Homyz Authentication
 * Prevents Open Redirect Vulnerabilities by verifying URLs are internal relative paths.
 */

/**
 * Sanitizes a callback/redirect URL.
 * Accepts only internal relative paths starting with "/" (and not "//" or "/\").
 * Defaults to fallbackUrl if invalid or external.
 */
export function getSafeCallbackUrl(
  url?: string | null,
  fallbackUrl = "/dashboard",
): string {
  if (!url || typeof url !== "string") {
    return fallbackUrl;
  }

  const trimmed = url.trim();

  // Reject empty string or dangerous relative URLs like "//evil.com" or "/\evil.com"
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\")
  ) {
    return fallbackUrl;
  }

  // Reject URLs containing protocol specifiers (e.g. "/redirect?to=http://")
  try {
    const parsed = new URL(trimmed, "http://localhost");
    // Ensure hostname matches dummy origin (strictly internal relative path)
    if (parsed.hostname !== "localhost") {
      return fallbackUrl;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallbackUrl;
  }
}
