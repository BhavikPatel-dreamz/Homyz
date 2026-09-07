<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Modal behavior

- Whenever a modal, confirmation dialog, lightbox, or blocking drawer is open, background page scrolling must be locked on mobile, tablet, and desktop.
- Use `ModalOverlay` from `@/components/ui/modal-overlay` as the outer overlay, rendered only while open. It shares a reference-counted body scroll lock, restores the prior scroll position/styles on final close or unmount, and ignores responsive overlays while hidden.
- Keep modal content scrollable when it exceeds the viewport. Do not add independent `document.body` or `document.documentElement` scroll-style mutations; they conflict with stacked modals.
- Anchored non-modal dropdowns do not need to lock background scrolling.
