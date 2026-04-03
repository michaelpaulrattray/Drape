/**
 * Proxy hero assets through our server to avoid CORS / preview-iframe issues.
 * - /api/hero/video  → streams background video from S3
 * - /api/hero/:asset → serves cached hero textures (base, styled, depth)
 *
 * IMPORTANT: The /video route MUST be registered before /:asset
 * because Express matches `:asset` greedily.
 */
import { Router, type Request, type Response } from "express";
import { gzipSync } from "node:zlib";
import { storageGet } from "./storage";
import { createModuleLogger } from "./logging/logger";
const log = createModuleLogger("heroProxy");

const router = Router();

const HERO_VIDEO_KEY = "homepage/hero-bg-video.mp4";

/* ── Video proxy (must be first) ────────────────────────────── */

let cachedVideoUrl: { url: string; expires: number } | null = null;

router.get("/api/hero/video", async (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");

  try {
    // Refresh cached S3 URL every 30 minutes
    if (!cachedVideoUrl || Date.now() > cachedVideoUrl.expires) {
      const { url } = await storageGet(HERO_VIDEO_KEY);
      cachedVideoUrl = { url, expires: Date.now() + 30 * 60 * 1000 };
    }

    // Forward range header for seeking support
    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const upstream = await fetch(cachedVideoUrl.url, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(502).json({ error: "Failed to fetch video from storage" });
      return;
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", "video/mp4");

    // Forward relevant headers
    const fwd = ["content-length", "content-range", "accept-ranges"];
    for (const h of fwd) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    // Pipe the body
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
    log.error({ err: err.message }, "[Hero Proxy] Error streaming video");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

/* ── Image texture proxy ────────────────────────────────────── */

const HERO_ASSETS: Record<string, string> = {
  base: "hero/base-v3.png",
  styled: "hero/styled-v3.png",
  depth: "hero/depth-v3.png",
};

const imageCache = new Map<
  string,
  { buffer: Buffer; gzipped: Buffer; contentType: string }
>();

router.get("/api/hero/:asset", async (req: Request, res: Response) => {
  const assetKey = req.params.asset;
  const s3Key = HERO_ASSETS[assetKey];

  if (!s3Key) {
    res.status(404).json({ error: "Unknown asset" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");

  const cached = imageCache.get(assetKey);
  if (cached) {
    res.setHeader("Content-Type", cached.contentType);
    const acceptsGzip = req.headers["accept-encoding"]?.includes("gzip");
    if (acceptsGzip) {
      res.setHeader("Content-Encoding", "gzip");
      res.send(cached.gzipped);
    } else {
      res.send(cached.buffer);
    }
    return;
  }

  try {
    const { url } = await storageGet(s3Key);
    const response = await fetch(url);

    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch from storage" });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";

    const gzipped = gzipSync(buffer, { level: 6 });
    imageCache.set(assetKey, { buffer, gzipped, contentType });

    res.setHeader("Content-Type", contentType);
    const acceptsGzip = req.headers["accept-encoding"]?.includes("gzip");
    if (acceptsGzip) {
      res.setHeader("Content-Encoding", "gzip");
      res.send(gzipped);
    } else {
      res.send(buffer);
    }
  } catch (err: any) {
    log.error({ err: err.message }, `[Hero Proxy] Error fetching ${assetKey}:`);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
