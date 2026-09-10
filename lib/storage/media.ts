import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Media storage backends, in order:
 *   1. S3_BUCKET          — AWS S3 / compatible (direct)
 *   2. MEDIA_SERVER_URL   — dedicated Homyz media service (local disk today, S3 later)
 *   3. public/uploads     — local fallback for `next dev` without the media process
 *
 * Public kinds return a browser URL (`/uploads/{kind}/{file}` unless S3 is on).
 * Private host documents stay behind the authenticated documents API.
 */

export type PublicMediaKind = "listing-photos" | "stamp-icons" | "guidebook-photos";
export type PrivateMediaKind = "host-documents";
export type MediaKind = PublicMediaKind | PrivateMediaKind;

const PUBLIC_KINDS = new Set<string>([
  "listing-photos",
  "stamp-icons",
  "guidebook-photos",
]);
const PRIVATE_KINDS = new Set<string>(["host-documents"]);
const ALL_KINDS = new Set<string>([...PUBLIC_KINDS, ...PRIVATE_KINDS]);
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

let s3ClientPromise: Promise<import("@aws-sdk/client-s3").S3Client | null> | null =
  null;

export function isS3Enabled(): boolean {
  return Boolean(process.env.S3_BUCKET?.trim());
}

export function isMediaServerEnabled(): boolean {
  return Boolean(process.env.MEDIA_SERVER_URL?.trim());
}

function bucket(): string {
  const name = process.env.S3_BUCKET?.trim();
  if (!name) throw new Error("S3_BUCKET is not set");
  return name;
}

function region(): string {
  return (
    process.env.S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-1"
  );
}

function objectKey(kind: MediaKind, fileName: string): string {
  const safe = path.basename(fileName);
  return `${kind}/${safe}`;
}

function publicBaseUrl(): string {
  const explicit = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return `https://${bucket()}.s3.${region()}.amazonaws.com`;
}

function mediaServerBase(): string {
  const base = process.env.MEDIA_SERVER_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("MEDIA_SERVER_URL is not set");
  return base;
}

function mediaServerSecret(): string {
  const secret = process.env.MEDIA_SERVER_SECRET?.trim();
  if (!secret) throw new Error("MEDIA_SERVER_SECRET is not set");
  return secret;
}

/** Browser-facing origin, e.g. https://media.homyz.co — not the Docker-internal URL. */
function mediaPublicBaseUrl(): string {
  return process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || "";
}

function publicMediaUrl(key: string, fallback?: string | null): string {
  const base = mediaPublicBaseUrl();
  if (base) return `${base}/uploads/${key}`;
  if (fallback) return fallback;
  return `/uploads/${key}`;
}

async function getS3(): Promise<import("@aws-sdk/client-s3").S3Client> {
  s3ClientPromise ??= (async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    return new S3Client({
      region: region(),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  })();
  const client = await s3ClientPromise;
  if (!client) throw new Error("Failed to initialize S3 client");
  return client;
}

function localDir(kind: MediaKind): string {
  return path.join(process.cwd(), "public", "uploads", kind);
}

function warnLocalDisk(): void {
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[storage] Neither S3_BUCKET nor MEDIA_SERVER_URL is set; writing media to local disk",
    );
  }
}

async function putS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<void> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
}

async function getS3Object(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!res.Body) throw new Error("Empty S3 object body");
  return Buffer.from(await res.Body.transformToByteArray());
}

async function deleteS3Object(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getS3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

async function mediaServerFetch(
  objectPath: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${mediaServerBase()}${objectPath}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${mediaServerSecret()}`,
    },
  });
}

async function putMediaServer(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ publicUrl: string | null }> {
  const res = await mediaServerFetch(`/v1/objects/${params.key}`, {
    method: "PUT",
    headers: { "Content-Type": params.contentType },
    body: new Uint8Array(params.body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Media server upload failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json().catch(() => null)) as { publicUrl?: string | null } | null;
  return { publicUrl: json?.publicUrl ?? null };
}

async function getMediaServer(key: string): Promise<Buffer> {
  const res = await mediaServerFetch(`/v1/objects/${key}`, { method: "GET" });
  if (res.status === 404) {
    throw Object.assign(new Error("Requested document file not found."), {
      code: "NOT_FOUND",
    });
  }
  if (!res.ok) {
    throw new Error(`Media server read failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function deleteMediaServer(key: string): Promise<void> {
  const res = await mediaServerFetch(`/v1/objects/${key}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Media server delete failed (${res.status})`);
  }
}

async function deleteLocal(kind: MediaKind, fileName: string): Promise<void> {
  try {
    await unlink(path.join(localDir(kind), fileName));
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code !== "ENOENT") throw err;
  }
}

export type ParsedManagedMedia = {
  kind: MediaKind;
  fileName: string;
  visibility: "public" | "private";
};

function asKind(value: string): MediaKind | null {
  return ALL_KINDS.has(value) ? (value as MediaKind) : null;
}

/**
 * Parse a stored media URL (relative `/uploads/...`, S3/CDN, or private document API).
 * Returns null for Unsplash/OAuth avatars and any other unmanaged URL.
 */
export function parseManagedMediaUrl(url: string | null | undefined): ParsedManagedMedia | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const privateDoc = trimmed.match(
    /\/api\/v1\/host\/application\/documents\/file\/([A-Za-z0-9][A-Za-z0-9._-]*)$/,
  );
  if (privateDoc) {
    return { kind: "host-documents", fileName: privateDoc[1], visibility: "private" };
  }

  let pathname = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }

  const uploads = pathname.match(
    /^\/uploads\/([a-z0-9-]+)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/,
  );
  if (uploads) {
    const kind = asKind(uploads[1]);
    if (!kind || !SAFE_FILE.test(uploads[2])) return null;
    return {
      kind,
      fileName: uploads[2],
      visibility: PUBLIC_KINDS.has(kind) ? "public" : "private",
    };
  }

  const objectPath = pathname.match(
    /^\/([a-z0-9-]+)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/,
  );
  if (objectPath) {
    const kind = asKind(objectPath[1]);
    if (!kind || !SAFE_FILE.test(objectPath[2])) return null;
    return {
      kind,
      fileName: objectPath[2],
      visibility: PUBLIC_KINDS.has(kind) ? "public" : "private",
    };
  }

  return null;
}

async function writeObject(options: {
  kind: MediaKind;
  fileName: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ url: string; fileName: string }> {
  const fileName = path.basename(options.fileName);
  const key = objectKey(options.kind, fileName);

  if (isS3Enabled()) {
    await putS3({
      key,
      body: options.body,
      contentType: options.contentType,
      cacheControl: options.cacheControl,
    });
    return { url: `${publicBaseUrl()}/${key}`, fileName };
  }

  if (isMediaServerEnabled()) {
    const saved = await putMediaServer({
      key,
      body: options.body,
      contentType: options.contentType,
    });
    return {
      url: publicMediaUrl(key, saved.publicUrl),
      fileName,
    };
  }

  warnLocalDisk();
  const dir = localDir(options.kind);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), options.body);
  return { url: `/uploads/${key}`, fileName };
}

async function removeObject(kind: MediaKind, fileName: string): Promise<void> {
  const safe = path.basename(fileName);
  const key = objectKey(kind, safe);

  if (isS3Enabled()) {
    await deleteS3Object(key);
    return;
  }
  if (isMediaServerEnabled()) {
    await deleteMediaServer(key);
    return;
  }
  await deleteLocal(kind, safe);
}

/**
 * Store a publicly viewable image. Returns the URL to persist on the listing.
 */
export async function savePublicMedia(options: {
  kind: PublicMediaKind;
  fileName: string;
  body: Buffer;
  contentType: string;
}): Promise<{ url: string; fileName: string }> {
  return writeObject(options);
}

/**
 * Store a private host document. Callers should keep serving it through the
 * authenticated `/api/v1/host/application/documents/file/[fileName]` route.
 */
export async function savePrivateMedia(options: {
  kind: PrivateMediaKind;
  fileName: string;
  body: Buffer;
  contentType: string;
}): Promise<{ fileName: string }> {
  const saved = await writeObject({
    ...options,
    cacheControl: "private, max-age=0, no-store",
  });
  return { fileName: saved.fileName };
}

export async function readPrivateMedia(
  kind: PrivateMediaKind,
  fileName: string,
): Promise<Buffer> {
  const safe = path.basename(fileName);

  if (isS3Enabled()) {
    try {
      return await getS3Object(objectKey(kind, safe));
    } catch {
      throw Object.assign(new Error("Requested document file not found."), {
        code: "NOT_FOUND",
      });
    }
  }

  if (isMediaServerEnabled()) {
    return getMediaServer(objectKey(kind, safe));
  }

  try {
    return await readFile(path.join(localDir(kind), safe));
  } catch {
    throw Object.assign(new Error("Requested document file not found."), {
      code: "NOT_FOUND",
    });
  }
}

export async function deletePublicMedia(options: {
  kind: PublicMediaKind;
  fileName: string;
}): Promise<void> {
  await removeObject(options.kind, options.fileName);
}

export async function deletePrivateMedia(options: {
  kind: PrivateMediaKind;
  fileName: string;
}): Promise<void> {
  await removeObject(options.kind, options.fileName);
}

/** Best-effort delete for a stored URL. Unmanaged URLs are ignored. */
export async function deleteManagedMediaUrl(url: string | null | undefined): Promise<void> {
  const parsed = parseManagedMediaUrl(url);
  if (!parsed) return;
  try {
    await removeObject(parsed.kind, parsed.fileName);
  } catch (err) {
    console.warn("[storage] failed to delete media", url, err);
  }
}

export async function deleteManagedMediaUrls(urls: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  await Promise.all(unique.map((url) => deleteManagedMediaUrl(url)));
}

export async function readPublicMediaFile(
  kind: PublicMediaKind,
  fileName: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  const safe = path.basename(fileName);
  if (!PUBLIC_KINDS.has(kind) || !SAFE_FILE.test(safe)) return null;

  try {
    if (isS3Enabled()) {
      const body = await getS3Object(objectKey(kind, safe));
      return { body, contentType: contentTypeFromName(safe) };
    }
    if (isMediaServerEnabled()) {
      const res = await fetch(`${mediaServerBase()}/uploads/${kind}/${safe}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Media server public read failed (${res.status})`);
      return {
        body: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get("content-type") || contentTypeFromName(safe),
      };
    }
    const body = await readFile(path.join(localDir(kind), safe));
    return { body, contentType: contentTypeFromName(safe) };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "ENOENT" || code === "NOT_FOUND") return null;
    throw err;
  }
}

function contentTypeFromName(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
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
    default:
      return "application/octet-stream";
  }
}
