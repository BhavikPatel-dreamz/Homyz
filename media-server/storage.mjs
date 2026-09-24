/**
 * Local-disk object store.
 * New keys: `{kind}/{YYYY}/{MM}/{fileName}` (for example `listing-photos/2026/08/photo.jpg`).
 * Older keys `{kind}/{fileName}` still resolve.
 * Swap this module for an S3/OSS backend later without changing the HTTP API.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MEDIA_KINDS = Object.freeze([
  "listing-photos",
  "stamp-icons",
  "guidebook-photos",
  "host-documents",
]);

export const PUBLIC_MEDIA_KINDS = Object.freeze([
  "listing-photos",
  "stamp-icons",
  "guidebook-photos",
]);

const KIND_SET = new Set(MEDIA_KINDS);
const PUBLIC_KIND_SET = new Set(PUBLIC_MEDIA_KINDS);
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const YEAR = /^\d{4}$/;
const MONTH = /^(0[1-9]|1[0-2])$/;

export function isPublicKind(kind) {
  return PUBLIC_KIND_SET.has(kind);
}

export function parseObjectKey(raw) {
  if (typeof raw !== "string" || !raw) return null;
  const parts = raw.replace(/^\/+/, "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return null;

  let kind;
  let fileName;
  if (parts.length === 2 && KIND_SET.has(parts[0]) && SAFE_FILE.test(parts[1])) {
    kind = parts[0];
    fileName = parts[1];
  } else if (
    parts.length === 4 &&
    KIND_SET.has(parts[0]) &&
    YEAR.test(parts[1]) &&
    MONTH.test(parts[2]) &&
    SAFE_FILE.test(parts[3])
  ) {
    kind = parts[0];
    fileName = parts[3];
  } else {
    return null;
  }

  return { kind, fileName, key: parts.join("/"), segments: parts };
}

function contentTypeFromName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export function createLocalStorage(dataDir) {
  const root = path.resolve(dataDir);

  function filePath(parsed) {
    return path.join(root, ...parsed.segments);
  }

  async function put(parsed, body, contentType) {
    const dest = filePath(parsed);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return {
      key: parsed.key,
      contentType: contentType || contentTypeFromName(parsed.fileName),
    };
  }

  async function get(parsed) {
    try {
      const body = await readFile(filePath(parsed));
      return { body, contentType: contentTypeFromName(parsed.fileName) };
    } catch (err) {
      if (err && err.code === "ENOENT") return null;
      throw err;
    }
  }

  async function remove(parsed) {
    try {
      await unlink(filePath(parsed));
      return true;
    } catch (err) {
      if (err && err.code === "ENOENT") return false;
      throw err;
    }
  }

  return { root, put, get, remove };
}
