/**
 * Image proxy endpoint — streams S3 images through our server
 * to bypass CORS restrictions for download and clipboard copy.
 *
 * GET /api/image-proxy?url=<encoded_url>&download=1
 *   - download=1: sets Content-Disposition: attachment for browser download
 *   - Without download: streams with proper content-type for clipboard use
 */
import { Router, type Request, type Response } from "express";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("imageProxy");
const router = Router();

/** Only allow proxying from our own S3 bucket */
const ALLOWED_HOSTS = [
  "manus-storage.s3",
  "manus-storage-",
  ".amazonaws.com",
  ".r2.cloudflarestorage.com",
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some((h) => parsed.hostname.includes(h));
  } catch {
    return false;
  }
}

router.get("/api/image-proxy", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  const download = req.query.download === "1";

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  if (!isAllowedUrl(url)) {
    res.status(403).json({ error: "URL not allowed" });
    return;
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(502).json({ error: "Failed to fetch image" });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "image/png";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    if (download) {
      // Extract filename from URL or use default
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split("/").pop() || "drape-image.png";
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    // Stream the response
    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
        }
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err: any) {
    log.error({ err: err.message }, "[ImageProxy] Error streaming image");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

export default router;
