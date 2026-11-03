"use client";

import { DragEvent, useId, useRef } from "react";

const MAX_FILES = 5;
const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|pdf)$/i;

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.ceil(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(file: File) {
  return file.type === "application/pdf" ? "PDF" : "IMG";
}

type AttachmentPickerProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  onError?: (message: string | null) => void;
  label?: string;
  description?: string;
};

export function AttachmentPicker({
  files,
  onChange,
  disabled = false,
  onError,
  label = "Attach supporting evidence",
  description = "Photos and PDF documents up to 15 MB each",
}: AttachmentPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (nextFiles: File[]) => {
    onError?.(null);
    const merged = [...files];
    const known = new Set(files.map(fileKey));

    for (const file of nextFiles) {
      if (
        !ACCEPTED_TYPES.has(file.type) &&
        !ACCEPTED_EXTENSIONS.test(file.name)
      ) {
        onError?.(`${file.name} is not a supported image or PDF file.`);
        continue;
      }
      if (!file.size) {
        onError?.(`${file.name} is empty.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        onError?.(`${file.name} is larger than the 15 MB limit.`);
        continue;
      }
      const key = fileKey(file);
      if (known.has(key)) {
        onError?.(`${file.name} is already selected.`);
        continue;
      }
      if (merged.length >= MAX_FILES) {
        onError?.("You can attach up to five files.");
        break;
      }
      known.add(key);
      merged.push(file);
    }

    onChange(merged);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) addFiles(Array.from(event.dataTransfer.files));
  };

  const openFileDialog = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="block cursor-pointer rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3.5 text-sm text-zinc-600 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 sm:p-4"
      >
        <span className="block text-sm font-medium text-zinc-950">{label}</span>
        <span className="mt-1 block text-xs text-zinc-500">
          Drag files here or use the button below
        </span>
        <span className="mt-1 block text-xs text-zinc-500">{description}</span>
        <span className="mt-2 block text-xs font-medium text-zinc-700">
          {files.length} / {MAX_FILES} files selected
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={openFileDialog}
          className="mt-3 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []));
            event.currentTarget.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Selected attachments">
          {files.map((file) => (
            <li
              key={fileKey(file)}
              className="flex min-w-0 items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm"
            >
              <span
                className="rounded bg-zinc-100 px-1.5 py-1 text-[10px] font-semibold text-zinc-700"
                aria-hidden="true"
              >
                {iconFor(file)}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    files.filter(
                      (selected) => fileKey(selected) !== fileKey(file),
                    ),
                  )
                }
                className="shrink-0 text-xs font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-950 disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
