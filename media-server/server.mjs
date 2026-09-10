/**
 * Homyz media service — owns the uploads folder.
 *
 * S3-like object API (shared secret; Next.js is the only caller):
 *   PUT    /v1/objects/{kind}/{fileName}   raw body
 *   GET    /v1/objects/{kind}/{fileName}
 *   DELETE /v1/objects/{kind}/{fileName}   idempotent
 *
 * Public images (browser, no auth):
 *   GET    /uploads/{kind}/{fileName}      listing / stamp / guidebook only
 *
 * Later: keep this HTTP contract and swap storage.mjs for S3/OSS.
 */
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLocalStorage,
  isPublicKind,
  parseObjectKey,
} from "./storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || "4001", 10);
const HOST = process.env.HOSTNAME || "0.0.0.0";
const MAX_BYTES = Number.parseInt(process.env.MEDIA_MAX_BYTES || String(15 * 1024 * 1024), 10);

const defaultDataDir = process.env.MEDIA_DATA_DIR?.trim()
  ? process.env.MEDIA_DATA_DIR.trim()
  : path.resolve(__dirname, "../public/uploads");

const storage = createLocalStorage(defaultDataDir);
const secret = process.env.MEDIA_SERVER_SECRET?.trim() || "";
const publicBase = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || "";

function publicObjectUrl(key) {
  return publicBase ? `${publicBase}/uploads/${key}` : `/uploads/${key}`;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cross-Origin-Resource-Policy": "cross-origin",
  };
}

if (!secret) {
  console.error("[media] MEDIA_SERVER_SECRET is required");
  process.exit(1);
}

function bearerOk(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendEmpty(res, status) {
  res.writeHead(status, { "Cache-Control": "no-store" });
  res.end();
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES) {
      const err = new Error("Object exceeds maximum size.");
      err.code = "TOO_LARGE";
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function objectFromUrl(url, prefixes) {
  for (const prefix of prefixes) {
    if (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) {
      return parseObjectKey(url.pathname.slice(prefix.length));
    }
  }
  return null;
}

function serveObject(res, object, { cacheControl, cors = false }) {
  if (!object) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": object.contentType,
    "Content-Length": object.body.length,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    ...(cors ? corsHeaders() : {}),
  });
  res.end(object.body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS" && url.pathname.startsWith("/uploads/")) {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/uploads/")) {
      const parsed = objectFromUrl(url, ["/uploads"]);
      if (!parsed || !isPublicKind(parsed.kind)) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      const object = await storage.get(parsed);
      if (req.method === "HEAD") {
        if (!object) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        res.writeHead(200, {
          "Content-Type": object.contentType,
          "Content-Length": object.body.length,
          "Cache-Control": "public, max-age=31536000, immutable",
          ...corsHeaders(),
        });
        res.end();
        return;
      }
      serveObject(res, object, {
        cacheControl: "public, max-age=31536000, immutable",
        cors: true,
      });
      return;
    }

    const parsedObject = objectFromUrl(url, ["/v1/objects"]);
    if (parsedObject && ["PUT", "GET", "DELETE", "HEAD"].includes(req.method || "")) {
      if (!bearerOk(req)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method === "PUT") {
        const body = await readBody(req);
        if (!body.length) {
          sendJson(res, 400, { error: "Empty object body." });
          return;
        }
        const contentType =
          (req.headers["content-type"] || "").split(";")[0].trim() || undefined;
        await storage.put(parsedObject, body, contentType);
        sendJson(res, 201, {
          ok: true,
          key: parsedObject.key,
          publicUrl: isPublicKind(parsedObject.kind)
            ? publicObjectUrl(parsedObject.key)
            : null,
        });
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const object = await storage.get(parsedObject);
        if (!object) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        if (req.method === "HEAD") {
          res.writeHead(200, {
            "Content-Type": object.contentType,
            "Content-Length": object.body.length,
            "Cache-Control": "private, max-age=0, no-store",
          });
          res.end();
          return;
        }
        serveObject(res, object, { cacheControl: "private, max-age=0, no-store" });
        return;
      }

      if (req.method === "DELETE") {
        await storage.remove(parsedObject);
        sendEmpty(res, 204);
        return;
      }
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    if (err && err.code === "TOO_LARGE") {
      sendJson(res, 413, { error: err.message });
      return;
    }
    console.error("[media]", err);
    sendJson(res, 500, { error: "Media server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[media] listening on ${HOST}:${PORT}`);
  console.log(`[media] data dir ${storage.root}`);
  if (publicBase) console.log(`[media] public base ${publicBase}`);
});
