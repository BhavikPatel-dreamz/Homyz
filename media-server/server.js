require("dotenv").config()

const cors = require("cors")
const express = require("express")
const fs = require("fs")
const multer = require("multer")
const path = require("path")
const sharp = require("sharp")

const PORT = process.env.PORT || 8002
const HOST = process.env.HOST || "http://localhost:8002"
const MAX_DIMENSION = 4000

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
])

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".mp4": "video/mp4",
  ".glb": "model/gltf-binary",
  ".js": "application/javascript",
  ".bin": "application/octet-stream"
}

const app = express()
const UPLOADS_DIR = path.resolve(__dirname, "uploads")

function getYearMonthPath(date = new Date()) {
  const year = date.getFullYear().toString()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}/${month}`
}

function sanitizeFilename(filename) {
  const extension = path.extname(filename)
  const basename = path.basename(filename, extension)

  const normalized = basename
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")

  const safeName = normalized || "file"
  const safeExtension = extension.toLowerCase().replace(/[^\w.]/g, "")

  return `${safeName}${safeExtension}`
}

function encodeUploadKey(key) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function ensureUploadDir(relativeDir) {
  const dir = path.join(UPLOADS_DIR, relativeDir)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function toUploadKey(absolutePath) {
  return path.relative(UPLOADS_DIR, absolutePath).split(path.sep).join("/")
}

function resolveUploadPath(key) {
  const filePath = path.resolve(UPLOADS_DIR, key)
  const relativePath = path.relative(UPLOADS_DIR, filePath)

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null
  }

  return filePath
}

function parseDimension(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.min(parsed, MAX_DIMENSION)
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

function isImage(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function isImageKey(key) {
  return IMAGE_EXTENSIONS.has(path.extname(key).toLowerCase())
}

function isPdfKey(key) {
  return path.extname(key).toLowerCase() === ".pdf"
}

function isDocumentKey(key) {
  const ext = path.extname(key).toLowerCase()
  return ext === ".doc" || ext === ".docx" || ext === ".txt" || ext === ".rtf"
}

function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      collectFiles(fullPath, files)
      continue
    }

    const key = toUploadKey(fullPath)
    const stat = fs.statSync(fullPath)

    files.push({
      key,
      filename: entry.name,
      url: `${HOST}/uploads/${encodeUploadKey(key)}`,
      size: stat.size,
      mimeType: getMimeType(fullPath),
      isImage: isImageKey(key),
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    })
  }

  return files
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

app.use(cors())
app.use(express.json())

async function serveUpload(req, res) {
  const key = req.params[0]

  if (!key) {
    return res.status(404).json({ error: "File not found" })
  }

  const filePath = resolveUploadPath(key)

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" })
  }

  const width = parseDimension(req.query.width)
  const height = parseDimension(req.query.height)
  const shouldResize = Boolean(width || height) && isImage(filePath)

  res.set("Cache-Control", "public, max-age=31536000, immutable")

  if (!shouldResize) {
    res.type(getMimeType(filePath))
    return res.sendFile(filePath)
  }

  try {
    const buffer = await sharp(filePath)
      .resize({
        width: width ?? undefined,
        height: height ?? undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer()

    res.type(getMimeType(filePath))
    return res.send(buffer)
  } catch {
    return res.status(500).json({ error: "Failed to process image" })
  }
}

app.get("/uploads/*", serveUpload)

// Unauthenticated liveness probe (compose healthcheck + proxy monitoring).
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uploadsDir: UPLOADS_DIR })
})

function authMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"]

  if (!apiKey || apiKey !== process.env.MEDIA_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  next()
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const subdir = getYearMonthPath()
    cb(null, ensureUploadDir(subdir))
  },
  filename(_req, file, cb) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 10)
    const cleanName = sanitizeFilename(file.originalname)
    cb(null, `${timestamp}-${random}-${cleanName}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter(_req, file, cb) {
    const isGlbByName =
      file.mimetype === "application/octet-stream" &&
      file.originalname.toLowerCase().endsWith(".glb")

    const isAllowed =
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "application/rtf" ||
      file.mimetype === "text/rtf" ||
      file.mimetype === "video/mp4" ||
      file.mimetype === "model/gltf-binary" ||
      isGlbByName

    if (isAllowed) {
      cb(null, true)
      return
    }

    cb(
      new Error(
        "Only image/*, PDF, DOC, DOCX, TXT, MP4, RTF and GLB files are allowed"
      )
    )
  },
})

app.use("/api", authMiddleware)

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" })
  }

  const key = toUploadKey(req.file.path)

  return res.json({
    url: `${HOST}/uploads/${encodeUploadKey(key)}`,
    key,
  })
})

const xrStorage = multer.diskStorage({
  destination(req, file, cb) {
    const sku = req.body.sku
    if (!sku) return cb(new Error("SKU required for XR upload"))
    const dir = path.join(UPLOADS_DIR, "xr", sku)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    cb(null, file.originalname)
  },
})

const uploadXR = multer({
  storage: xrStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
})

app.post("/api/xr/upload", authMiddleware, uploadXR.fields([{ name: "files", maxCount: 10 }]), (req, res) => {
  const sku = req.body.sku
  if (!sku) {
    return res.status(400).json({ error: "SKU is required" })
  }

  const files = req.files?.files || []
  if (files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" })
  }

  const dataFile = files.find((f) => f.originalname === "xr.bin" || f.originalname === "data.js")
  const miniDataFile = files.find((f) => f.originalname === "mini_xr.bin" || f.originalname === "mini_data.js")

  const dataUrl = dataFile
    ? `${HOST}/uploads/xr/${encodeUploadKey(sku)}/${dataFile.originalname}`
    : null
  const miniDataUrl = miniDataFile
    ? `${HOST}/uploads/xr/${encodeUploadKey(sku)}/${miniDataFile.originalname}`
    : null

  return res.json({
    sku,
    dataUrl,
    miniDataUrl,
    uploadedFiles: files.map((f) => f.originalname),
  })
})

app.get("/api/files", (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1)
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20)
  )
  const query = String(req.query.q ?? "").trim().toLowerCase()
  const type = String(req.query.type ?? "all").toLowerCase()

  let files = collectFiles(UPLOADS_DIR)

  if (type === "image") {
    files = files.filter((file) => file.isImage)
  } else if (type === "pdf") {
    files = files.filter((file) => isPdfKey(file.key))
  } else if (type === "document") {
    files = files.filter((file) => isDocumentKey(file.key))
  } else if (type !== "all") {
    files = files.filter((file) => file.isImage)
  }

  if (query) {
    files = files.filter(
      (file) =>
        file.key.toLowerCase().includes(query) ||
        file.filename.toLowerCase().includes(query)
    )
  }

  files.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const total = files.length
  const offset = (page - 1) * limit
  const items = files.slice(offset, offset + limit)

  return res.json({
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit) || 1),
  })
})

function handleDelete(req, res) {
  const key = req.params[0] ?? req.params.key
  const filePath = resolveUploadPath(key)

  if (!filePath) {
    return res.status(403).json({ error: "Forbidden" })
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "File not found" })
      }

      return res.status(500).json({ error: "Failed to delete file" })
    }

    return res.status(200).json({ deleted: true, key })
  })
}

app.delete("/api/delete/*", handleDelete)
app.delete("/api/delete/:key", handleDelete)

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File exceeds 50MB limit" })
    }

    return res.status(400).json({ error: err.message })
  }

  if (err) {
    return res.status(400).json({ error: err.message })
  }

  next()
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Media server listening on ${HOST} (port ${PORT})`)
})
