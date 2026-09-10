/**
 * Local-disk object store. Keys look like S3 keys: `{kind}/{fileName}`.
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

export function isPublicKind(kind) {
  return PUBLIC_KIND_SET.has(kind);
}

export function parseObjectKey(raw) {
  if (typeof raw !== "string" || !raw) return null;
  const normalized = raw.replace(/^\/+/, "").replace(/\\/g, "/");
  const slash = normalized.indexOf("/");
  if (slash <= 0) return null;
  const kind = normalized.slice(0, slash);
  const fileName = path.basename(normalized.slice(slash + 1));
  if (!KIND_SET.has(kind) || fileName.includes("/") || !SAFE_FILE.test(fileName)) {
    return null;
  }
  return { kind, fileName, key: `${kind}/${fileName}` };
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
    return path.join(root, parsed.kind, parsed.fileName);
  }

  async function put(parsed, body, contentType) {
    const dir = path.join(root, parsed.kind);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath(parsed), body);
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
