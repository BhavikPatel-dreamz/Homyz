import assert from "node:assert/strict";
import test from "node:test";

import { savePublicMedia } from "../lib/storage/media";

test("savePublicMedia fails when the configured media server is unreachable", async () => {
  const originalMediaUrl = process.env.MEDIA_SERVER_URL;
  const originalMediaSecret = process.env.MEDIA_SERVER_SECRET;
  const originalS3Bucket = process.env.S3_BUCKET;

  process.env.MEDIA_SERVER_URL = "http://127.0.0.1:65535";
  process.env.MEDIA_SERVER_SECRET = "fallback-secret";
  process.env.S3_BUCKET = "";

  try {
    await assert.rejects(
      savePublicMedia({
        kind: "travel-covers",
        fileName: "fallback-upload.png",
        body: Buffer.from("fallback-data"),
        contentType: "image/png",
      }),
      /fetch failed|Media server upload failed/i,
    );
  } finally {
    if (originalMediaUrl === undefined) {
      delete process.env.MEDIA_SERVER_URL;
    } else {
      process.env.MEDIA_SERVER_URL = originalMediaUrl;
    }

    if (originalMediaSecret === undefined) {
      delete process.env.MEDIA_SERVER_SECRET;
    } else {
      process.env.MEDIA_SERVER_SECRET = originalMediaSecret;
    }

    if (originalS3Bucket === undefined) {
      delete process.env.S3_BUCKET;
    } else {
      process.env.S3_BUCKET = originalS3Bucket;
    }
  }
});
