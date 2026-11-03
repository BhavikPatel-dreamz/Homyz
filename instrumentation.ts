import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { recordPublicDiagnostic } = await import("@/lib/diagnostics/public-diagnostics");
  await recordPublicDiagnostic({
    source: "server",
    message: "Server instance started.",
    severity: "info",
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  // File logging is available only in the Node.js runtime. Edge deployments
  // should use their platform's observability service instead.
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { recordPublicDiagnostic } = await import("@/lib/diagnostics/public-diagnostics");
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : null;

  await recordPublicDiagnostic({
    source: `next:${context.routeType}:${context.routePath}`,
    message: "Unhandled server request error.",
    error,
    digest,
  });
};
