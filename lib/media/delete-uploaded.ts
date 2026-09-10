/** Browser helper: ask the Next.js app to delete a file from the media service. */
export function deleteUploadedMedia(url: string | null | undefined): void {
  if (!url || typeof url !== "string") return;
  void fetch("/api/v1/upload", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {
    // Best-effort; listing save also sweeps removed URLs server-side.
  });
}
