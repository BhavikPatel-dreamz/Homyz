import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Media storage: S3 when S3_BUCKET is set, otherwise local `public/uploads`.
 *
 * Public kinds (listing photos, stamp icons) return a browser-reachable URL.
 * Private host documents stay behind the existing authenticated API; only the
 * object bytes move to S3 so multi-EC2 / immutable containers can read them.
 *
 * Credentials: prefer the EC2 instance role / IRSA. Set AWS_ACCESS_KEY_ID and
 * AWS_SECRET_ACCESS_KEY only when a role is unavailable (local/CI).
 */

export type PublicMediaKind = "listing-photos" | "stamp-icons";
export type PrivateMediaKind = "host-documents";
export type MediaKind = PublicMediaKind | PrivateMediaKind;

let s3ClientPromise: Promise<import("@aws-sdk/client-s3").S3Client | null> | null =
  null;

export function isS3Enabled(): boolean {
  return Boolean(process.env.S3_BUCKET?.trim());
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

/**
 * Store a publicly viewable image. Returns the URL to persist on the listing.
 * Production on EC2/ALB should set S3_BUCKET so files survive container replace.
 */
export async function savePublicMedia(options: {
  kind: PublicMediaKind;
  fileName: string;
  body: Buffer;
  contentType: string;
}): Promise<{ url: string; fileName: string }> {
  const fileName = path.basename(options.fileName);

  if (isS3Enabled()) {
    const key = objectKey(options.kind, fileName);
    await putS3({
      key,
      body: options.body,
      contentType: options.contentType,
    });
    return { url: `${publicBaseUrl()}/${key}`, fileName };
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[storage] S3_BUCKET is not set; writing media to local disk (ephemeral in Docker/multi-EC2)",
    );
  }

  const dir = localDir(options.kind);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), options.body);
  return { url: `/uploads/${options.kind}/${fileName}`, fileName };
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
  const fileName = path.basename(options.fileName);

  if (isS3Enabled()) {
    await putS3({
      key: objectKey(options.kind, fileName),
      body: options.body,
      contentType: options.contentType,
      cacheControl: "private, max-age=0, no-store",
    });
    return { fileName };
  }

  const dir = localDir(options.kind);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), options.body);
  return { fileName };
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

  return readFile(path.join(localDir(kind), safe));
}
