# Media Server

Standalone Express server for Medusa.js file uploads. Stores files on disk and exposes authenticated upload/delete APIs plus public static file serving.

## Setup

```bash
cd media-server
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port (default: `8002`) |
| `HOST` | Public base URL used in upload responses (default: `http://localhost:8002`) |
| `MEDIA_API_KEY` | Shared secret; required on all `/api/*` requests via `x-api-key` header |

## Run

```bash
npm start
```

The server creates `./uploads` automatically if it does not exist. Files are stored by upload date under `./uploads/YYYY/MM/` (for example `./uploads/2026/01/`).

## API

### `GET /api/files`

Requires header: `x-api-key: <MEDIA_API_KEY>`

List uploaded files with search and pagination.

Query params:

| Param | Default | Description |
| --- | --- | --- |
| `page` | `1` | Page number |
| `limit` | `20` | Items per page (max 100) |
| `q` | — | Search filename or key |
| `type` | `all` | `all`, `image`, `pdf`, or `document` |

Response:

```json
{
  "items": [
    {
      "key": "2026/06/1781594126963-photo.jpg",
      "filename": "1781594126963-photo.jpg",
      "url": "http://localhost:8002/uploads/2026/06/1781594126963-photo.jpg",
      "size": 123456,
      "mimeType": "image/jpeg",
      "isImage": true,
      "createdAt": "2026-06-16T10:00:00.000Z",
      "updatedAt": "2026-06-16T10:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

### `POST /api/upload`

Requires header: `x-api-key: <MEDIA_API_KEY>`

Multipart form field: `file`

Allowed types: `image/*`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `application/rtf` (max 10MB)

Response:

```json
{
  "url": "http://localhost:8002/uploads/2026/01/1710000000000-abc123-photo.jpg",
  "key": "2026/01/1710000000000-abc123-photo.jpg"
}
```

The `key` includes the year/month path and is used for deletes.

### `DELETE /api/delete/:key`

Requires header: `x-api-key: <MEDIA_API_KEY>`

Deletes a file by its stored key from the upload response (for example `2026/01/filename.jpg`). Slashes in the key are supported.

### `GET /uploads/YYYY/MM/:filename`

Public static access (no API key required).

Optional query params for images (ignored for PDFs):

| Param | Description |
| --- | --- |
| `width` | Max width in pixels (maintains aspect ratio) |
| `height` | Max height in pixels (maintains aspect ratio) |

Both can be used together. Images are resized with `fit: inside` and never upscaled. Max dimension: 4000px.

Examples:

```
/uploads/2026/06/photo.jpg
/uploads/2026/06/photo.jpg?width=800
/uploads/2026/06/photo.jpg?height=600
/uploads/2026/06/photo.jpg?width=800&height=600
```

## Test with curl

Start the server, then:

```bash
# Upload
curl -X POST http://localhost:8002/api/upload \
  -H "x-api-key: change-me-to-a-secure-random-string" \
  -F "file=@./test-image.jpg"

# Delete (replace KEY with the key from the upload response, e.g. 2026/01/1781...-photo.jpg)
curl -X DELETE "http://localhost:8002/api/delete/KEY" \
  -H "x-api-key: change-me-to-a-secure-random-string"

# Public access (no auth)
curl -I "http://localhost:8002/uploads/KEY"

# Resized image
curl -I "http://localhost:8002/uploads/KEY?width=800&height=600"
```

## Medusa integration

In your Medusa backend (`backend`), set:

```env
MEDIA_SERVER_API_URL=http://localhost:8002/api
MEDIA_SERVER_API_KEY=change-me-to-a-secure-random-string
```

`MEDIA_SERVER_API_KEY` must match `MEDIA_API_KEY` in this server's `.env`.

The Medusa custom file provider posts to `${MEDIA_SERVER_API_URL}/upload` and deletes via `${MEDIA_SERVER_API_URL}/delete/:key`.

After updating env vars, restart both the media server and the Medusa backend.
