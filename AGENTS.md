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

## Loading UI behavior

- Treat every `loading.tsx` and in-component skeleton as a layout contract with the UI it replaces. Reuse or inherit the same page shell, container width, responsive grid, major section order, and persistent controls; do not introduce a nested `max-w-*`, centering wrapper, or different breakpoint layout unless the rendered UI has the same constraint.
- Before changing or adding a loading state, compare it with its resolved page and parent layout at mobile and desktop widths. Preserve the footprint of prominent content (headers, sidebars, cards, media, and fixed/sticky panels) to avoid layout shift when data resolves.
- Route loading files do not receive route params. When an exact variant cannot be selected, render the representative page structure rather than a generic, narrower placeholder.

## Host listing editor UI work

- Preserve existing state, navigation, save behavior, and developer functionality when implementing host listing editor designs. Make UI-only changes unless a task explicitly requests functional changes.
- Do not alter the Listing Description page unless the task explicitly includes it.
